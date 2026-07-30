import {
  Badge,
  Box,
  Button,
  HStack,
  IconButton,
  NumberInput,
  NumberInputField,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { api } from "@/lib/api";
import { clearBuyerCart, readBuyerCart, writeBuyerCart } from "@/lib/buyerCart";

export default function BuyerCart() {
  const toast = useToast();
  const router = useRouter();
  const [cart, setCart] = useState([]);
  const [cartReady, setCartReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCart(readBuyerCart());
    setCartReady(true);
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    writeBuyerCart(cart);
  }, [cart, cartReady]);

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);

  function updateQty(productId, qty) {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        if (qty > item.maxStock) {
          toast({ title: "Insufficient stock", status: "warning" });
          return item;
        }
        return { ...item, qty: Math.max(1, qty) };
      })
    );
  }

  function removeItem(productId) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  async function placeOrder() {
    if (cart.length === 0) return;

    const storeId = cart[0].storeId;
    if (!storeId) {
      toast({
        title: "Missing store",
        description: "Clear the cart and add items again from the shop.",
        status: "error",
      });
      return;
    }

    const mixedStore = cart.some((item) => String(item.storeId) !== String(storeId));
    if (mixedStore) {
      toast({
        title: "Cart has items from multiple stores",
        description: "Clear the cart and order from one store at a time.",
        status: "error",
      });
      return;
    }

    setLoading(true);
    try {
      await api.checkout({
        storeId,
        items: cart.map(({ productId, qty }) => ({ productId, qty })),
        note: "Pickup at sari-sari store",
      });
      toast({
        title: "Pickup order placed!",
        description: "Wait for the seller to confirm, then collect at the store.",
        status: "success",
        duration: 5000,
      });
      setCart([]);
      clearBuyerCart();
      router.push("/buyer/orders");
    } catch (err) {
      toast({ title: err.message, status: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute role="buyer">
      <Layout title="Pickup Cart">
        <Box bg="teal.50" borderWidth="1px" borderColor="teal.100" p={4} rounded="lg" mb={4}>
          <Text fontWeight="semibold" color="teal.800">
            Pickup only
          </Text>
          <Text fontSize="sm" color="teal.700">
            Place your order here, then pick it up at the sari-sari store after the seller confirms.
          </Text>
        </Box>
        <Box bg="white" p={6} rounded="lg" shadow="sm">
          {!cartReady ? (
            <Text color="gray.500" textAlign="center" py={8}>
              Loading cart…
            </Text>
          ) : cart.length === 0 ? (
            <Box textAlign="center" py={8}>
              <Text color="gray.500" mb={4}>
                Your cart is empty
              </Text>
              <Button as={NextLink} href="/buyer" colorScheme="teal">
                Browse Products
              </Button>
            </Box>
          ) : (
            <>
              <Table size="sm" mb={4}>
                <Thead>
                  <Tr>
                    <Th>Item</Th>
                    <Th isNumeric>Qty</Th>
                    <Th isNumeric>Subtotal</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {cart.map((item) => (
                    <Tr key={item.productId}>
                      <Td>
                        <Text fontWeight="medium">{item.name}</Text>
                        <Text fontSize="sm" color="gray.500">
                          ₱{Number(item.unitPrice).toFixed(2)} each
                        </Text>
                      </Td>
                      <Td isNumeric>
                        <NumberInput
                          size="sm"
                          min={1}
                          max={item.maxStock}
                          value={item.qty}
                          onChange={(_, v) => updateQty(item.productId, v || 1)}
                          w="80px"
                        >
                          <NumberInputField />
                        </NumberInput>
                      </Td>
                      <Td isNumeric>₱{(Number(item.unitPrice) * item.qty).toFixed(2)}</Td>
                      <Td>
                        <IconButton
                          size="xs"
                          icon={<DeleteIcon />}
                          aria-label="Remove"
                          onClick={() => removeItem(item.productId)}
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>

              <HStack justify="space-between" mb={4}>
                <Text fontWeight="bold" fontSize="lg">
                  Total
                </Text>
                <Badge colorScheme="teal" fontSize="lg" px={3} py={1}>
                  ₱{total.toFixed(2)}
                </Badge>
              </HStack>

              <Button colorScheme="teal" w="full" onClick={placeOrder} isLoading={loading}>
                Place pickup order
              </Button>
            </>
          )}
        </Box>
      </Layout>
    </ProtectedRoute>
  );
}
