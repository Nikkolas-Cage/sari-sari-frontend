import {
  Avatar,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  HStack,
  IconButton,
  Image,
  Input,
  Select,
  Spinner,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { AttachmentIcon, CloseIcon } from "@chakra-ui/icons";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { sendRealtime, subscribeRealtime } from "@/lib/realtime";
import { MessageTicks, TypingBubble } from "@/components/ChatStatus";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MessagesPanel() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [conversations, setConversations] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [otherUserId, setOtherUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimer = useRef(null);
  const peerTypingClear = useRef(null);
  const fileRef = useRef(null);

  const active = conversations.find((c) => c.id === activeId) || null;

  const loadConversations = useCallback(async () => {
    const [{ conversations: list }, { users }] = await Promise.all([
      api.getConversations(),
      api.getChatDirectory(),
    ]);
    setConversations(list);
    setDirectory(users);
  }, []);

  useEffect(() => {
    loadConversations()
      .catch((err) => toast({ title: err.message, status: "error" }))
      .finally(() => setLoading(false));
  }, [loadConversations, toast]);

  useEffect(() => {
    const q = router.query?.c;
    if (typeof q === "string" && q) setActiveId(q);
  }, [router.query]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }

    sendRealtime({ type: "join", room: `chat:${activeId}` });
    let cancelled = false;

    api
      .getMessages(activeId)
      .then(async ({ messages: list }) => {
        if (cancelled) return;
        setMessages(list);
        const viewing =
          typeof document === "undefined" || document.visibilityState === "visible";
        if (viewing) {
          await api.markChatRead(activeId).catch(() => {});
        } else {
          await api.markChatDelivered(activeId).catch(() => {});
        }
      })
      .catch((err) => toast({ title: err.message, status: "error" }));

    return () => {
      cancelled = true;
      sendRealtime({ type: "leave", room: `chat:${activeId}` });
    };
  }, [activeId, toast]);

  useEffect(() => {
    function onVisibility() {
      if (!activeId) return;
      if (document.visibilityState === "visible") {
        api.markChatRead(activeId).catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [activeId]);

  useEffect(() => {
    return subscribeRealtime((msg) => {
      if (!msg?.type) return;

      const pageVisible =
        typeof document === "undefined" || document.visibilityState === "visible";
      const viewingActive = Boolean(activeId) && msg.conversationId === activeId && pageVisible;

      if (msg.type === "chat:message") {
        if (msg.message?.senderId !== user?.id && msg.conversationId) {
          if (viewingActive) {
            api.markChatRead(msg.conversationId).catch(() => {});
          } else {
            api.markChatDelivered(msg.conversationId).catch(() => {});
          }
        }

        if (msg.conversationId === activeId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.message.id)) {
              return prev.map((m) => (m.id === msg.message.id ? { ...m, ...msg.message } : m));
            }
            const cleaned = prev.filter(
              (m) =>
                !(
                  String(m.id).startsWith("temp-") &&
                  m.senderId === msg.message.senderId &&
                  m.text === msg.message.text
                )
            );
            return [...cleaned, msg.message];
          });
          loadConversations().catch(() => {});
        }

        if (msg.conversationId !== activeId) {
          loadConversations().catch(() => {});
        }
      }

      if (msg.type === "chat:typing" && msg.conversationId === activeId && msg.userId !== user?.id) {
        setPeerTyping(Boolean(msg.isTyping));
        if (peerTypingClear.current) clearTimeout(peerTypingClear.current);
        peerTypingClear.current = setTimeout(() => setPeerTyping(false), 2500);
      }

      if (msg.type === "chat:delivered" && msg.conversationId === activeId && msg.userId !== user?.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === user?.id && m.status === "sent" ? { ...m, status: "delivered" } : m
          )
        );
      }

      if (msg.type === "chat:read" && msg.conversationId === activeId && msg.userId !== user?.id) {
        setMessages((prev) =>
          prev.map((m) => (m.senderId === user?.id ? { ...m, status: "read" } : m))
        );
      }
    });
  }, [activeId, user?.id, loadConversations]);

  function onType(value) {
    setText(value);
    if (!activeId) return;
    sendRealtime({ type: "chat:typing", conversationId: activeId, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      sendRealtime({ type: "chat:typing", conversationId: activeId, isTyping: false });
    }, 1200);
  }

  async function onPickFiles(e) {
    const files = Array.from(e.target.files || []).slice(0, 3);
    const next = [];
    for (const file of files) {
      if (file.size > 2_000_000) {
        toast({ title: `${file.name} is too large (max 2MB)`, status: "warning" });
        continue;
      }
      const url = await fileToDataUrl(file);
      next.push({
        type: file.type.startsWith("image/") ? "image" : "file",
        url: String(url),
        name: file.name,
        mimeType: file.type,
      });
    }
    setPendingFiles((prev) => [...prev, ...next].slice(0, 4));
    e.target.value = "";
  }

  async function startChat() {
    if (!otherUserId) return;
    try {
      const { conversation } = await api.startConversation(otherUserId);
      await loadConversations();
      setActiveId(conversation.id);
      setOtherUserId("");
    } catch (err) {
      toast({ title: err.message, status: "error" });
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!activeId || (!text.trim() && pendingFiles.length === 0)) return;
    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      senderId: user?.id,
      text: text.trim(),
      attachments: pendingFiles,
      status: "sent",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const payloadText = text.trim();
    const payloadFiles = pendingFiles;
    setText("");
    setPendingFiles([]);
    try {
      sendRealtime({ type: "chat:typing", conversationId: activeId, isTyping: false });
      const { message } = await api.sendMessage(activeId, payloadText, payloadFiles);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? message : m)));
      await loadConversations();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast({ title: err.message, status: "error" });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <Flex justify="center" py={16}>
        <Spinner />
      </Flex>
    );
  }

  return (
    <Flex direction={{ base: "column", md: "row" }} gap={4} minH="480px" align="stretch">
      <Box
        w={{ base: "full", md: "280px" }}
        bg="white"
        rounded="lg"
        shadow="sm"
        p={4}
        flexShrink={0}
      >
        <Text fontWeight="bold" mb={3}>
          Start a chat
        </Text>
        <HStack mb={4}>
          <Select
            placeholder={user?.role === "seller" ? "Select a buyer" : "Select a seller"}
            value={otherUserId}
            onChange={(e) => setOtherUserId(e.target.value)}
            size="sm"
          >
            {directory.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Button size="sm" colorScheme="teal" onClick={startChat} isDisabled={!otherUserId}>
            Chat
          </Button>
        </HStack>

        <Divider mb={3} />
        <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.600">
          Conversations
        </Text>
        <VStack align="stretch" spacing={1} maxH="360px" overflowY="auto">
          {conversations.length === 0 && (
            <Text fontSize="sm" color="gray.500">
              No messages yet.
            </Text>
          )}
          {conversations.map((c) => (
            <Button
              key={c.id}
              variant={c.id === activeId ? "solid" : "ghost"}
              colorScheme={c.id === activeId ? "teal" : "gray"}
              justifyContent="flex-start"
              h="auto"
              py={2}
              onClick={() => setActiveId(c.id)}
            >
              <HStack spacing={3} align="center" w="full">
                <Avatar size="sm" name={c.otherUser?.name} src={c.otherUser?.avatarUrl || undefined} />
                <Box textAlign="left" overflow="hidden">
                  <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>
                    {c.otherUser?.name || "User"}
                  </Text>
                  <Text fontSize="xs" opacity={0.8} noOfLines={1}>
                    {c.lastMessagePreview || "No messages"}
                  </Text>
                </Box>
              </HStack>
            </Button>
          ))}
        </VStack>
      </Box>

      <Flex flex="1" direction="column" bg="white" rounded="lg" shadow="sm" overflow="hidden" minH="420px">
        <Box px={4} py={3} borderBottomWidth="1px">
          {active ? (
            <HStack spacing={3}>
              <Avatar
                size="md"
                name={active.otherUser?.name}
                src={active.otherUser?.avatarUrl || undefined}
              />
              <Box>
                <Text fontWeight="semibold">{active.otherUser?.name}</Text>
                {peerTyping ? (
                  <TypingBubble />
                ) : (
                  <Text fontSize="xs" color="gray.500" textTransform="capitalize">
                    {active.otherUser?.role}
                  </Text>
                )}
              </Box>
            </HStack>
          ) : (
            <Text color="gray.500">Select or start a conversation</Text>
          )}
        </Box>

        <VStack flex="1" align="stretch" spacing={3} p={4} overflowY="auto" bg="gray.50">
          {!active && (
            <Text color="gray.500" textAlign="center" mt={8}>
              Pick someone from the directory, or inquire from a product card.
            </Text>
          )}
          {messages.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <Flex key={m.id} justify={mine ? "flex-end" : "flex-start"}>
                <Box
                  maxW="75%"
                  bg={mine ? "teal.500" : "white"}
                  color={mine ? "white" : "gray.800"}
                  px={3}
                  py={2}
                  rounded="lg"
                  shadow="sm"
                >
                  {(m.attachments || []).map((a, idx) =>
                    a.type === "image" ? (
                      <Image
                        key={`${m.id}-${idx}`}
                        src={a.url}
                        alt={a.name}
                        maxH="180px"
                        rounded="md"
                        mb={2}
                      />
                    ) : (
                      <Text key={`${m.id}-${idx}`} fontSize="xs" mb={1}>
                        📎 {a.name}
                      </Text>
                    )
                  )}
                  {m.text && <Text fontSize="sm">{m.text}</Text>}
                  {mine && (
                    <HStack justify="flex-end" spacing={1} mt={1}>
                      <Text fontSize="10px" opacity={0.85}>
                        {m.status === "read"
                          ? "Read"
                          : m.status === "delivered"
                            ? "Delivered"
                            : "Sent"}
                      </Text>
                      <MessageTicks status={m.status || "sent"} light />
                    </HStack>
                  )}
                </Box>
              </Flex>
            );
          })}
          {peerTyping && active && (
            <Flex justify="flex-start">
              <Box bg="white" px={3} py={2} rounded="lg" shadow="sm">
                <TypingBubble />
              </Box>
            </Flex>
          )}
        </VStack>

        {pendingFiles.length > 0 && (
          <HStack px={3} py={2} spacing={2} overflowX="auto" borderTopWidth="1px">
            {pendingFiles.map((f, i) => (
              <Box key={i} position="relative">
                {f.type === "image" ? (
                  <Image src={f.url} alt={f.name} boxSize="56px" objectFit="cover" rounded="md" />
                ) : (
                  <Text fontSize="xs" maxW="80px" noOfLines={2}>
                    {f.name}
                  </Text>
                )}
                <IconButton
                  aria-label="Remove"
                  size="xs"
                  icon={<CloseIcon boxSize={2} />}
                  position="absolute"
                  top="-1"
                  right="-1"
                  onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                />
              </Box>
            ))}
          </HStack>
        )}

        <Box as="form" onSubmit={sendMessage} p={3} borderTopWidth="1px">
          <FormControl>
            <HStack>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf,.txt,.doc,.docx"
                multiple
                hidden
                onChange={onPickFiles}
              />
              <IconButton
                aria-label="Attach file"
                icon={<AttachmentIcon />}
                variant="ghost"
                isDisabled={!active}
                onClick={() => fileRef.current?.click()}
              />
              <Input
                value={text}
                onChange={(e) => onType(e.target.value)}
                placeholder={active ? "Type a message…" : "Select a chat first"}
                isDisabled={!active}
              />
              <Button
                type="submit"
                colorScheme="teal"
                isLoading={sending}
                isDisabled={!active || (!text.trim() && pendingFiles.length === 0)}
              >
                Send
              </Button>
            </HStack>
          </FormControl>
        </Box>
      </Flex>
    </Flex>
  );
}
