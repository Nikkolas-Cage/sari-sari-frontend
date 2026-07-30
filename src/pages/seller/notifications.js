import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { CalendarIcon, ChatIcon, CheckIcon, InfoIcon } from "@chakra-ui/icons";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { api } from "@/lib/api";
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
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export default function SellerNotificationsPage() {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await api.getNotifications({ limit: 50 });
    setItems(data.notifications || []);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => toast({ title: err.message, status: "error" }))
      .finally(() => setLoading(false));

    return subscribeRealtime((msg) => {
      if (msg?.type === "notification:new" && msg.notification) {
        setItems((prev) => [msg.notification, ...prev.filter((n) => n.id !== msg.notification.id)]);
      }
    });
  }, [load, toast]);

  async function openNotification(n) {
    try {
      if (!n.read) await api.markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    } catch {
      // still navigate
    }
    if (n.href) router.push(n.href);
  }

  async function markAll() {
    try {
      await api.markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      toast({ title: err.message, status: "error" });
    }
  }

  return (
    <ProtectedRoute role="seller">
      <Layout title="Notifications">
        <Flex justify="space-between" align="center" mb={4}>
          <Text color="gray.600">Messages, inquiries, cart activity, and pickup orders</Text>
          <Button size="sm" variant="ghost" colorScheme="teal" onClick={markAll}>
            Mark all as read
          </Button>
        </Flex>

        <Box bg="white" rounded="xl" shadow="sm" borderWidth="1px" overflow="hidden">
          {loading && (
            <Text p={8} color="gray.500" textAlign="center">
              Loading…
            </Text>
          )}
          {!loading && items.length === 0 && (
            <Text p={10} color="gray.500" textAlign="center">
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
                  textAlign="left"
                  w="full"
                  px={4}
                  py={3}
                  bg={n.read ? "white" : "teal.50"}
                  _hover={{ bg: n.read ? "gray.50" : "teal.100" }}
                  onClick={() => openNotification(n)}
                  borderBottomWidth="1px"
                  borderColor="gray.100"
                >
                  <HStack align="start" spacing={3}>
                    <Avatar
                      size="md"
                      name={n.actorName || "User"}
                      src={n.actorAvatarUrl || undefined}
                    />
                    <Box flex="1" minW={0}>
                      <Text fontWeight={n.read ? "medium" : "bold"} noOfLines={2}>
                        {n.title}
                      </Text>
                      {n.body && (
                        <Text fontSize="sm" color="gray.600" noOfLines={2} mt={0.5}>
                          {n.body}
                        </Text>
                      )}
                      <HStack mt={1} spacing={2}>
                        <Icon boxSize={3} color="teal.600" />
                        <Text fontSize="xs" color="teal.600" fontWeight="semibold">
                          {timeAgo(n.createdAt)}
                        </Text>
                        {!n.read && <Badge colorScheme="teal">New</Badge>}
                      </HStack>
                    </Box>
                  </HStack>
                </Box>
              );
            })}
          </VStack>
        </Box>
      </Layout>
    </ProtectedRoute>
  );
}
