import {
  Badge,
  Box,
  Button,
  HStack,
  Text,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { CheckIcon, TimeIcon } from "@chakra-ui/icons";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { api } from "@/lib/api";
import { subscribeRealtime } from "@/lib/realtime";

const STATUS_COLOR = {
  pending: "orange",
  confirmed: "blue",
  ready: "purple",
  completed: "green",
  cancelled: "red",
};

export default function SellerPickupOrders() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);

  async function load() {
    const data = await api.getSales();
    setOrders((data.sales || []).filter((s) => s.fulfillmentType !== "pos" || s.buyerId));
  }

  useEffect(() => {
    load().catch(console.error);
    return subscribeRealtime((msg) => {
      if (msg?.type === "order:created" || msg?.type === "order:status") {
        load().catch(console.error);
        if (msg.type === "order:created") {
          toast({
            title: "New pickup order",
            description: msg.order?.buyerName
              ? `${msg.order.buyerName} · ₱${Number(msg.order.totalAmount).toFixed(2)}`
              : "A buyer placed a pickup order",
            status: "info",
            duration: 5000,
            isClosable: true,
          });
        }
      }
    });
  }, [toast]);

  async function setStatus(id, status) {
    try {
      await api.updateOrderStatus(id, status);
      toast({ title: `Order ${status}`, status: "success" });
      await load();
    } catch (err) {
      toast({ title: err.message, status: "error" });
    }
  }

  const pickupOrders = orders.filter((o) => o.fulfillmentType === "pickup" || o.buyerId);

  return (
    <ProtectedRoute role="seller">
      <Layout title="Pickup Orders">
        <Text mb={4} color="gray.600">
          Confirm buyer pickup orders in real time. Mark ready when the bag is prepared at the
          counter.
        </Text>
        <VStack align="stretch" spacing={4}>
          {pickupOrders.map((order) => (
            <Box key={order.id} bg="white" p={5} rounded="lg" shadow="sm" borderWidth="1px">
              <HStack justify="space-between" mb={2} flexWrap="wrap">
                <Box>
                  <Text fontWeight="bold">{order.buyerName || "Buyer"}</Text>
                  <Text fontSize="sm" color="gray.500">
                    {new Date(order.timestamp).toLocaleString()}
                  </Text>
                </Box>
                <HStack>
                  <Badge colorScheme={STATUS_COLOR[order.status] || "gray"}>
                    {order.status || "pending"}
                  </Badge>
                  <Text fontWeight="bold">₱{Number(order.totalAmount).toFixed(2)}</Text>
                </HStack>
              </HStack>
              <Text fontSize="sm" mb={3}>
                {(order.items || []).map((i) => `${i.name} ×${i.qty}`).join(", ")}
              </Text>
              <Text fontSize="xs" color="teal.600" mb={3}>
                Fulfillment: Store pickup
              </Text>
              <HStack flexWrap="wrap">
                {order.status === "pending" && (
                  <Button
                    size="sm"
                    colorScheme="blue"
                    leftIcon={<CheckIcon />}
                    onClick={() => setStatus(order.id, "confirmed")}
                  >
                    Confirm order
                  </Button>
                )}
                {(order.status === "pending" || order.status === "confirmed") && (
                  <Button
                    size="sm"
                    colorScheme="purple"
                    leftIcon={<TimeIcon />}
                    onClick={() => setStatus(order.id, "ready")}
                  >
                    Ready for pickup
                  </Button>
                )}
                {order.status === "ready" && (
                  <Button
                    size="sm"
                    colorScheme="green"
                    onClick={() => setStatus(order.id, "completed")}
                  >
                    Mark picked up
                  </Button>
                )}
              </HStack>
            </Box>
          ))}
          {pickupOrders.length === 0 && (
            <Box bg="white" p={8} rounded="lg" textAlign="center" color="gray.500">
              No pickup orders yet. They appear here instantly when a buyer checks out.
            </Box>
          )}
        </VStack>
      </Layout>
    </ProtectedRoute>
  );
}
