import {
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Image,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { AttachmentIcon, ChatIcon, CloseIcon, MinusIcon } from "@chakra-ui/icons";
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

/**
 * Facebook Messenger-style docked chat (lower left).
 */
export default function FloatingChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const fileRef = useRef(null);
  const typingTimer = useRef(null);
  const peerTypingClear = useRef(null);
  const bottomRef = useRef(null);

  const active = conversations.find((c) => c.id === activeId) || null;

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { conversations: list } = await api.getConversations();
    setConversations(list || []);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadConversations().catch(() => {});
  }, [user, loadConversations]);

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
        setMessages(list || []);
        // Only mark read when the dock is open and expanded; otherwise delivered
        const viewing = open && !minimized && document.visibilityState === "visible";
        if (viewing) {
          await api.markChatRead(activeId).catch(() => {});
        } else {
          await api.markChatDelivered(activeId).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      sendRealtime({ type: "leave", room: `chat:${activeId}` });
    };
  }, [activeId, open, minimized]);

  // When user expands / opens chat to view the active thread → mark read
  useEffect(() => {
    if (!activeId || !open || minimized) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    api.markChatRead(activeId).catch(() => {});
  }, [open, minimized, activeId]);

  useEffect(() => {
    function onVisibility() {
      if (!activeId || !open || minimized) return;
      if (document.visibilityState === "visible") {
        api.markChatRead(activeId).catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [activeId, open, minimized]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping, open, minimized]);

  useEffect(() => {
    return subscribeRealtime((msg) => {
      if (!msg?.type) return;

      const viewingActive =
        open &&
        !minimized &&
        activeId &&
        msg.conversationId === activeId &&
        (typeof document === "undefined" || document.visibilityState === "visible");

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
        } else if (open) {
          loadConversations().catch(() => {});
        }
      }
      if (msg.type === "chat:typing" && msg.conversationId === activeId && msg.userId !== user?.id) {
        setPeerTyping(Boolean(msg.isTyping));
        if (peerTypingClear.current) clearTimeout(peerTypingClear.current);
        if (msg.isTyping) {
          peerTypingClear.current = setTimeout(() => setPeerTyping(false), 2500);
        }
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
  }, [activeId, user?.id, open, minimized, loadConversations]);

  if (!user) return null;

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
      if (file.size > 2_000_000) continue;
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

  async function send() {
    if (!activeId || (!text.trim() && pendingFiles.length === 0)) return;
    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      senderId: user.id,
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
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  }

  const launcher = (
    <IconButton
      aria-label="Open chat"
      icon={<ChatIcon />}
      colorScheme="blue"
      rounded="md"
      size="lg"
      shadow="lg"
      onClick={() => {
        setOpen(true);
        setMinimized(false);
        loadConversations().catch(() => {});
      }}
    />
  );

  if (!open) {
    return (
      <Box position="fixed" right={{ base: 3, md: 5 }} bottom={{ base: 3, md: 5 }} zIndex={1400}>
        {launcher}
      </Box>
    );
  }

  return (
    <Box
      position="fixed"
      right={{ base: 2, md: 5 }}
      bottom={{ base: 2, md: 5 }}
      zIndex={1400}
      w={{ base: "calc(100vw - 16px)", sm: "360px" }}
      maxW="360px"
    >
      <Box
        bg="white"
        rounded="md"
        shadow="2xl"
        borderWidth="1px"
        borderColor="gray.300"
        overflow="hidden"
        h={minimized ? "auto" : "460px"}
        display="flex"
        flexDirection="column"
      >
        <Flex
          bg="blue.600"
          color="white"
          px={3}
          py={2}
          align="center"
          justify="space-between"
          cursor="pointer"
          onClick={() => setMinimized((v) => !v)}
        >
          <HStack>
            {active ? (
              <Avatar
                size="sm"
                name={active.otherUser?.name}
                src={active.otherUser?.avatarUrl || undefined}
                bg="whiteAlpha.400"
              />
            ) : (
              <ChatIcon />
            )}
            <Text fontWeight="bold" fontSize="sm">
              {active ? active.otherUser?.name : "Messages"}
            </Text>
          </HStack>
          <HStack spacing={1} onClick={(e) => e.stopPropagation()}>
            <IconButton
              aria-label="Minimize"
              size="xs"
              variant="ghost"
              color="white"
              icon={<MinusIcon />}
              onClick={() => setMinimized((v) => !v)}
            />
            <IconButton
              aria-label="Close"
              size="xs"
              variant="ghost"
              color="white"
              icon={<CloseIcon boxSize={2.5} />}
              onClick={() => {
                setOpen(false);
                setActiveId(null);
              }}
            />
          </HStack>
        </Flex>

        {!minimized && (
          <>
            {!activeId ? (
              <VStack align="stretch" spacing={0} flex="1" overflowY="auto">
                {conversations.length === 0 && (
                  <Text p={4} fontSize="sm" color="gray.500">
                    No conversations yet. Inquire about a product to start chatting.
                  </Text>
                )}
                {conversations.map((c) => (
                  <Box
                    key={c.id}
                    as="button"
                    textAlign="left"
                    px={3}
                    py={2}
                    borderBottomWidth="1px"
                    _hover={{ bg: "gray.50" }}
                    onClick={() => setActiveId(c.id)}
                  >
                    <HStack>
                      <Avatar size="sm" name={c.otherUser?.name} src={c.otherUser?.avatarUrl || undefined} />
                      <Box minW={0}>
                        <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>
                          {c.otherUser?.name}
                        </Text>
                        <Text fontSize="xs" color="gray.500" noOfLines={1}>
                          {c.lastMessagePreview || "No messages"}
                        </Text>
                      </Box>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            ) : (
              <>
                <HStack px={3} py={2} borderBottomWidth="1px" bg="gray.50" spacing={3}>
                  <Button size="xs" variant="ghost" onClick={() => setActiveId(null)}>
                    ←
                  </Button>
                  <Avatar
                    size="sm"
                    name={active?.otherUser?.name}
                    src={active?.otherUser?.avatarUrl || undefined}
                  />
                    <Box minW={0}>
                    <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>
                      {active?.otherUser?.name}
                    </Text>
                    {peerTyping ? (
                      <TypingBubble />
                    ) : (
                      <Text fontSize="xs" color="gray.500" textTransform="capitalize">
                        {active?.otherUser?.role}
                      </Text>
                    )}
                  </Box>
                </HStack>
                <VStack flex="1" align="stretch" spacing={2} p={3} overflowY="auto" bg="gray.50">
                  {messages.map((m) => {
                    const mine = m.senderId === user.id;
                    return (
                      <Flex key={m.id} justify={mine ? "flex-end" : "flex-start"}>
                        <Box
                          maxW="80%"
                          bg={mine ? "blue.500" : "white"}
                          color={mine ? "white" : "gray.800"}
                          px={3}
                          py={2}
                          rounded="sm"
                          shadow="sm"
                          borderWidth={mine ? "0" : "1px"}
                          borderColor="gray.200"
                        >
                          {(m.attachments || []).map((a, idx) =>
                            a.type === "image" ? (
                              <Image
                                key={`${m.id}-${idx}`}
                                src={a.url}
                                alt={a.name}
                                maxH="140px"
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
                  {peerTyping && (
                    <Flex justify="flex-start">
                      <Box bg="white" borderWidth="1px" borderColor="gray.200" px={3} py={2} rounded="sm" shadow="sm">
                        <TypingBubble />
                      </Box>
                    </Flex>
                  )}
                  <div ref={bottomRef} />
                </VStack>
                {pendingFiles.length > 0 && (
                  <HStack px={3} py={1} overflowX="auto" spacing={2} bg="white">
                    {pendingFiles.map((f, i) => (
                      <Box key={i} position="relative">
                        {f.type === "image" ? (
                          <Image src={f.url} alt={f.name} boxSize="48px" objectFit="cover" rounded="md" />
                        ) : (
                          <Text fontSize="xs">{f.name}</Text>
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
                <HStack p={2} borderTopWidth="1px" bg="white">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf,.txt,.doc,.docx"
                    multiple
                    hidden
                    onChange={onPickFiles}
                  />
                  <IconButton
                    aria-label="Attach"
                    icon={<AttachmentIcon />}
                    size="sm"
                    variant="ghost"
                    onClick={() => fileRef.current?.click()}
                  />
                  <Input
                    size="sm"
                    placeholder="Aa"
                    value={text}
                    onChange={(e) => onType(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  <Button size="sm" colorScheme="blue" onClick={send} isLoading={sending}>
                    Send
                  </Button>
                </HStack>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
