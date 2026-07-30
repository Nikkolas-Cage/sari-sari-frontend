import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Text,
  useDisclosure,
  useToast,
  VStack,
  Flex,
  Divider,
} from "@chakra-ui/react";
import { AddIcon, DeleteIcon, MinusIcon, SearchIcon } from "@chakra-ui/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import BarcodeScanner from "@/components/BarcodeScanner";
import { api } from "@/lib/api";
import { subscribeRealtime } from "@/lib/realtime";

function ProductThumb({ src, name, boxSize = "64px" }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        boxSize={boxSize}
        objectFit="cover"
        rounded="md"
        borderWidth="1px"
        borderColor="gray.100"
        flexShrink={0}
        bg="gray.50"
      />
    );
  }
  return (
    <Flex
      boxSize={boxSize}
      rounded="md"
      bg="orange.50"
      align="center"
      justify="center"
      flexShrink={0}
      borderWidth="1px"
      borderColor="orange.100"
    >
      <Text fontSize="xs" color="orange.300" fontWeight="bold" textAlign="center" px={1}>
        Sari
      </Text>
    </Flex>
  );
}

export default function SellerPOS() {
  const toast = useToast();
  const scanModal = useDisclosure();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [barcode, setBarcode] = useState("");
  const [search, setSearch] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const loadProducts = useCallback(() => {
    return api.getProducts().then((d) => setProducts(d.products || []));
  }, []);

  useEffect(() => {
    loadProducts().catch(console.error);
    return subscribeRealtime((msg) => {
      if (msg?.type?.startsWith("product:")) {
        loadProducts().catch(console.error);
      }
    });
  }, [loadProducts]);

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const addToCart = useCallback(
    (product, qty = 1) => {
      if (product.currentStock <= 0) {
        toast({ title: "Out of stock", status: "warning" });
        return false;
      }
      if (qty > product.currentStock) {
        toast({
          title: "Insufficient stock",
          description: `Only ${product.currentStock} available`,
          status: "warning",
        });
        return false;
      }

      let ok = true;
      setCart((prev) => {
        const existing = prev.find((i) => i.productId === product.id);
        if (existing) {
          const newQty = existing.qty + qty;
          if (newQty > product.currentStock) {
            toast({
              title: "Insufficient stock",
              description: `Only ${product.currentStock} available`,
              status: "warning",
            });
            ok = false;
            return prev;
          }
          return prev.map((i) => (i.productId === product.id ? { ...i, qty: newQty } : i));
        }
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unitPrice: product.unitPrice,
            qty,
            maxStock: product.currentStock,
            imageUrl: product.imageUrl || null,
            category: product.category || "",
          },
        ];
      });
      return ok;
    },
    [toast]
  );

  function bumpQty(productId, delta) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const next = item.qty + delta;
          if (next > item.maxStock) {
            toast({ title: "Insufficient stock", status: "warning" });
            return item;
          }
          return { ...item, qty: next };
        })
        .filter((item) => item.qty > 0)
    );
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  const lookupBarcode = useCallback(
    async (code) => {
      const trimmed = String(code || "").trim();
      if (!trimmed) return;
      try {
        const { product } = await api.getProductByBarcode(trimmed);
        if (addToCart(product)) {
          setBarcode("");
          toast({ title: `Added ${product.name}`, status: "success", duration: 1500 });
        }
      } catch {
        toast({ title: "Product not found", description: trimmed, status: "error" });
      }
    },
    [addToCart, toast]
  );

  async function handleBarcodeScan(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    await lookupBarcode(barcode);
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      await api.checkout({
        items: cart.map(({ productId, qty }) => ({ productId, qty })),
      });
      toast({ title: "Sale completed!", status: "success" });
      setCart([]);
      await loadProducts();
    } catch (err) {
      toast({ title: err.message, status: "error" });
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <ProtectedRoute role="seller">
      <Layout title="Point of Sale">
        <Box
          display="grid"
          gridTemplateColumns={{ base: "1fr", xl: "1.6fr 1fr" }}
          gap={6}
          alignItems="start"
        >
          <Box bg="white" p={{ base: 4, md: 6 }} rounded="xl" shadow="sm" borderWidth="1px">
            <HStack justify="space-between" mb={4} flexWrap="wrap" spacing={3}>
              <Box>
                <Text fontWeight="bold" fontSize="lg">
                  Products
                </Text>
                <Text fontSize="sm" color="gray.500">
                  Tap a card or scan a barcode to add to cart
                </Text>
              </Box>
              <Badge colorScheme="teal" fontSize="sm" px={3} py={1} rounded="md">
                {filtered.length} items
              </Badge>
            </HStack>

            <FormControl mb={4}>
              <FormLabel fontSize="sm">Scan / Enter Barcode</FormLabel>
              <HStack>
                <Input
                  placeholder="Scan barcode and press Enter"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={handleBarcodeScan}
                  bg="gray.50"
                />
                <Button
                  leftIcon={<SearchIcon />}
                  colorScheme="teal"
                  variant="outline"
                  onClick={scanModal.onOpen}
                  flexShrink={0}
                >
                  Camera / JPG
                </Button>
              </HStack>
            </FormControl>

            <InputGroup mb={5}>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search name, category, or barcode"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                bg="gray.50"
              />
            </InputGroup>

            <SimpleGrid columns={{ base: 2, md: 3, lg: 3, "2xl": 4 }} spacing={4} maxH="620px" overflowY="auto" pr={1}>
              {filtered.map((p) => {
                const out = p.currentStock <= 0;
                return (
                  <Box
                    key={p.id}
                    as="button"
                    textAlign="left"
                    borderWidth="1px"
                    borderColor={out ? "gray.100" : "gray.200"}
                    rounded="lg"
                    overflow="hidden"
                    bg={out ? "gray.50" : "white"}
                    opacity={out ? 0.65 : 1}
                    transition="all 0.15s"
                    _hover={out ? {} : { shadow: "md", borderColor: "teal.300", transform: "translateY(-2px)" }}
                    onClick={() => !out && addToCart(p)}
                    disabled={out}
                  >
                    {p.imageUrl ? (
                      <Image src={p.imageUrl} alt={p.name} h="120px" w="full" objectFit="cover" />
                    ) : (
                      <Flex h="120px" bg="orange.50" align="center" justify="center">
                        <Text color="orange.300" fontWeight="bold" fontSize="sm">
                          No image
                        </Text>
                      </Flex>
                    )}
                    <VStack align="stretch" spacing={1} p={3}>
                      <Text fontWeight="semibold" fontSize="sm" noOfLines={2} minH="40px">
                        {p.name}
                      </Text>
                      <HStack justify="space-between">
                        <Badge colorScheme="purple" fontSize="10px">
                          {p.category}
                        </Badge>
                        <Text fontWeight="bold" color="teal.600" fontSize="sm">
                          ₱{Number(p.unitPrice).toFixed(2)}
                        </Text>
                      </HStack>
                      <Text fontSize="xs" color={out ? "red.500" : "gray.500"}>
                        {out ? "Out of stock" : `${p.currentStock} in stock`}
                      </Text>
                      <Button
                        size="xs"
                        colorScheme="teal"
                        leftIcon={<AddIcon />}
                        isDisabled={out}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(p);
                        }}
                      >
                        Add
                      </Button>
                    </VStack>
                  </Box>
                );
              })}
            </SimpleGrid>
            {filtered.length === 0 && (
              <Text textAlign="center" color="gray.500" py={10}>
                No products match your search
              </Text>
            )}
          </Box>

          <Box
            bg="white"
            p={{ base: 4, md: 6 }}
            rounded="xl"
            shadow="sm"
            borderWidth="1px"
            position={{ xl: "sticky" }}
            top={{ xl: 4 }}
          >
            <HStack justify="space-between" mb={4}>
              <Box>
                <Text fontWeight="bold" fontSize="lg">
                  Cart
                </Text>
                <Text fontSize="sm" color="gray.500">
                  {cartCount} item{cartCount === 1 ? "" : "s"}
                </Text>
              </Box>
              {cart.length > 0 && (
                <Button size="xs" variant="ghost" colorScheme="red" onClick={() => setCart([])}>
                  Clear
                </Button>
              )}
            </HStack>

            {cart.length === 0 ? (
              <Flex
                direction="column"
                align="center"
                justify="center"
                py={12}
                borderWidth="1px"
                borderStyle="dashed"
                borderColor="gray.200"
                rounded="lg"
                bg="gray.50"
              >
                <Text color="gray.500" mb={1}>
                  Cart is empty
                </Text>
                <Text fontSize="sm" color="gray.400">
                  Add products from the grid or scan a barcode
                </Text>
              </Flex>
            ) : (
              <VStack align="stretch" spacing={3} maxH="480px" overflowY="auto" mb={4}>
                {cart.map((item) => (
                  <HStack
                    key={item.productId}
                    align="start"
                    spacing={3}
                    p={3}
                    borderWidth="1px"
                    rounded="lg"
                    bg="gray.50"
                  >
                    <ProductThumb src={item.imageUrl} name={item.name} boxSize="56px" />
                    <Box flex="1" minW={0}>
                      <Text fontWeight="semibold" fontSize="sm" noOfLines={2}>
                        {item.name}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        ₱{Number(item.unitPrice).toFixed(2)} each
                      </Text>
                      <HStack mt={2} spacing={2}>
                        <IconButton
                          aria-label="Decrease"
                          size="xs"
                          icon={<MinusIcon />}
                          onClick={() => bumpQty(item.productId, -1)}
                        />
                        <Text fontWeight="bold" minW="24px" textAlign="center">
                          {item.qty}
                        </Text>
                        <IconButton
                          aria-label="Increase"
                          size="xs"
                          icon={<AddIcon />}
                          onClick={() => bumpQty(item.productId, 1)}
                          isDisabled={item.qty >= item.maxStock}
                        />
                        <Text fontSize="sm" fontWeight="semibold" ml="auto">
                          ₱{(item.unitPrice * item.qty).toFixed(2)}
                        </Text>
                      </HStack>
                    </Box>
                    <IconButton
                      aria-label="Remove"
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      icon={<DeleteIcon />}
                      onClick={() => removeFromCart(item.productId)}
                    />
                  </HStack>
                ))}
              </VStack>
            )}

            <Divider my={4} />
            <HStack justify="space-between" mb={4}>
              <Text fontWeight="bold" fontSize="lg">
                Total
              </Text>
              <Badge colorScheme="teal" fontSize="xl" px={4} py={2} rounded="md">
                ₱{cartTotal.toFixed(2)}
              </Badge>
            </HStack>
            <Button
              colorScheme="teal"
              size="lg"
              w="full"
              onClick={handleCheckout}
              isLoading={checkoutLoading}
              isDisabled={cart.length === 0}
            >
              Checkout
            </Button>
          </Box>
        </Box>

        <Modal isOpen={scanModal.isOpen} onClose={scanModal.onClose} isCentered size="lg">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Scan barcode</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <BarcodeScanner
                onDetected={(code) => {
                  lookupBarcode(code);
                }}
                onClose={scanModal.onClose}
              />
            </ModalBody>
          </ModalContent>
        </Modal>
      </Layout>
    </ProtectedRoute>
  );
}
