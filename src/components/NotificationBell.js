import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { BellIcon, ChatIcon, CheckIcon, CalendarIcon, InfoIcon } from "@chakra-ui/icons";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { subscribeRealtime } from "@/lib/realtime";

function typeIcon(type) {
  if (type === "message" || type === "inquire") return ChatIcon;
  if (type === "order" || type?.startsWith("order_")) return CheckIcon;
  if (type === "cart_add") return CalendarIcon;
  return InfoIcon;
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function toastStatus(type) {
  if (type === "order_cancelled") return "warning";
  if (type === "order_confirmed" || type === "order_ready" || type === "order_completed") return "success";
  if (type === "order" || type === "cart_add") return "info";
  if (type === "message" || type === "inquire") return "info";
  return "info";
}

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const allPath = user?.role === "seller" ? "/seller/notifications" : "/buyer/notifications";

  const load = useCallback(async () => {
    if (!user) return;
    const data = await api.getNotifications({ limit: 12 });
    setItems(data.notifications || []);
    setUnread(data.unreadCount || 0);
  }, [user]);

  const showNotificationToast = useCallback(
    (n) => {
      if (!n) return;
      const isMessage = n.type === "message" || n.type === "inquire";
      const title = n.title || "New notification";
      const description = n.body || "";

      if (isMessage) {
        toast({
          id: `notif-${n.id}`,
          duration: 5000,
          isClosable: true,
          position: "top-right",
          render: ({ onClose }) => (
            <Box
              as="button"
              textAlign="left"
              w="full"
              maxW="360px"
              bg="white"
              color="gray.800"
              shadow="lg"
              borderWidth="1px"
              borderColor="gray.200"
              rounded="md"
              p={3}
              onClick={() => {
                onClose();
                if (n.href) router.push(n.href);
              }}
            >
              <HStack align="start" spacing={3}>
                <Avatar size="md" name={n.actorName || "User"} src={n.actorAvatarUrl || undefined} />
                <Box flex="1" minW={0}>
                  <Text fontWeight="bold" fontSize="sm" noOfLines={2}>
                    {title}
                  </Text>
                  {description && (
                    <Text fontSize="sm" color="gray.600" noOfLines={3} mt={0.5}>
                      {description}
                    </Text>
                  )}
                  <Text fontSize="xs" color="teal.600" mt={1}>
                    Tap to open chat
                  </Text>
                </Box>
              </HStack>
            </Box>
          ),
        });
        return;
      }

      toast({
        id: `notif-${n.id}`,
        title,
        description,
        status: toastStatus(n.type),
        duration: 4500,
        isClosable: true,
        position: "top-right",
        onCloseComplete: undefined,
      });
    },
    [toast, router]
  );

  useEffect(() => {
    load().catch(() => {});
    return subscribeRealtime((msg) => {
      if (msg?.type !== "notification:new" || !msg.notification) return;
      const n = msg.notification;
      setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 12));
      setUnread((c) => c + 1);
      showNotificationToast(n);
    });
  }, [load, showNotificationToast]);

  if (!user) return null;

  async function openNotification(n) {
    try {
      if (!n.read) {
        await api.markNotificationRead(n.id);
        setUnread((c) => Math.max(0, c - 1));
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      }
    } catch {
      // ignore
    }
    if (n.href) router.push(n.href);
  }

  return (
    <Popover placement="bottom-end" isLazy>
      <PopoverTrigger>
        <Box position="relative">
          <IconButton
            aria-label="Notifications"
            icon={<BellIcon boxSize={5} />}
            variant="ghost"
            colorScheme="whiteAlpha"
            color="white"
          />
          {unread > 0 && (
            <Badge
              position="absolute"
              top="0"
              right="0"
              colorScheme="red"
              borderRadius="full"
              fontSize="0.65rem"
              minW="18px"
              textAlign="center"
            >
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Box>
      </PopoverTrigger>
      <PopoverContent w="360px" maxW="92vw" color="gray.800">
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader fontWeight="bold" borderBottomWidth="1px">
          <Flex justify="space-between" align="center" pr={6}>
            <Text>Notifications</Text>
            <Button as={NextLink} href={allPath} size="xs" variant="link" colorScheme="teal">
              See all
            </Button>
          </Flex>
        </PopoverHeader>
        <PopoverBody p={0} maxH="420px" overflowY="auto">
          {items.length === 0 && (
            <Text p={6} color="gray.500" textAlign="center" fontSize="sm">
              No notifications yet
            </Text>
          )}
          <VStack align="stretch" spacing={0}>
            {items.map((n) => {
              const Icon = typeIcon(n.type);
              return (
                <Box
                  key={n.id}
                  as="button"
                  w="full"
                  textAlign="left"
                  px={3}
                  py={3}
                  bg={n.read ? "white" : "teal.50"}
                  _hover={{ bg: n.read ? "gray.50" : "teal.100" }}
                  borderBottomWidth="1px"
                  borderColor="gray.100"
                  onClick={() => openNotification(n)}
                >
                  <HStack align="start" spacing={3}>
                    <Avatar size="sm" name={n.actorName || "Store"} src={n.actorAvatarUrl || undefined} />
                    <Box flex="1" minW={0}>
                      <Text fontSize="sm" fontWeight={n.read ? "medium" : "bold"} noOfLines={2}>
                        {n.title}
                      </Text>
                      {n.body && (
                        <Text fontSize="xs" color="gray.600" noOfLines={2}>
                          {n.body}
                        </Text>
                      )}
                      <HStack mt={1} spacing={1}>
                        <Icon boxSize={2.5} color="teal.600" />
                        <Text fontSize="xs" color="teal.600">
                          {timeAgo(n.createdAt)}
                        </Text>
                      </HStack>
                    </Box>
                  </HStack>
                </Box>
              );
            })}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
