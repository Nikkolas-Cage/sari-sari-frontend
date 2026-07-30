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
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Text,
  Textarea,
  useDisclosure,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { AddIcon, ChatIcon, SearchIcon } from "@chakra-ui/icons";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { api } from "@/lib/api";
import { readBuyerCart, writeBuyerCart } from "@/lib/buyerCart";
import { subscribeRealtime } from "@/lib/realtime";

const CATEGORIES = ["All", "Snacks", "Beverages", "Canned Goods", "Personal Care", "Household", "Other"];

export default function BuyerBrowse() {
  const toast = useToast();
  const router = useRouter();
  const inquireModal = useDisclosure();
  const detailModal = useDisclosure();
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [cartReady, setCartReady] = useState(false);
  const [inquireProduct, setInquireProduct] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [inquiring, setInquiring] = useState(false);

  useEffect(() => {
    setCart(readBuyerCart());
    setCartReady(true);
    api
      .getStores()
      .then((d) => {
        setStores(d.stores);
        if (d.stores.length > 0) setSelectedStore(String(d.stores[0].storeId));
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedStore) return;
    const params = { storeId: selectedStore };
    if (category !== "All") params.category = category;
    api
      .getProducts(params)
      .then((d) => setProducts(d.products))
      .catch(console.error);
  }, [selectedStore, category]);

  useEffect(() => {
    return subscribeRealtime((msg) => {
      if (!msg?.type?.startsWith("product:")) return;
      if (!selectedStore) return;
      const params = { storeId: selectedStore };
      if (category !== "All") params.category = category;
      api.getProducts(params).then((d) => setProducts(d.products)).catch(console.error);
    });
  }, [selectedStore, category]);

  useEffect(() => {
    if (!cartReady) return;
    writeBuyerCart(cart);
  }, [cart, cartReady]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, search]);

  function addToCart(product) {
    if (product.currentStock === 0) {
      toast({ title: "Out of stock", status: "warning" });
      return;
    }

    api.trackProductClick(product.id).catch(() => {});

    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.qty + 1 > product.currentStock) {
          toast({ title: "Insufficient stock", status: "warning" });
          return prev;
        }
        return prev.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.unitPrice,
          qty: 1,
          maxStock: product.currentStock,
          storeId: product.storeId || selectedStore,
          imageUrl: product.imageUrl || null,
        },
      ];
    });
    toast({ title: "Added for store pickup", status: "success", duration: 1500 });
    api.notifyCartAdd(product.id).catch(() => {});
  }

  function openInquire(product) {
    api.trackProductClick(product.id).catch(() => {});
    setInquireProduct(product);
    setPrompt(
      `Hi! I'm inquiring about "${product.name}" (₱${Number(product.unitPrice).toFixed(
        2
      )}). Is this available for pickup at your sari-sari store?`
    );
    inquireModal.onOpen();
  }

  function openProduct(product) {
    api.trackProductView(product.id).catch(() => {});
    setDetailProduct(product);
    detailModal.onOpen();
  }

  async function sendInquiry() {
    if (!inquireProduct) return;
    setInquiring(true);
    try {
      const { conversation } = await api.inquireProduct({
        productId: inquireProduct.id,
        prompt,
      });
      inquireModal.onClose();
      toast({ title: "Inquiry sent to seller", status: "success" });
      router.push(`/buyer/messages?c=${conversation.id}`);
    } catch (err) {
      toast({ title: err.message, status: "error" });
    } finally {
      setInquiring(false);
    }
  }

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const storeName = stores.find((s) => String(s.storeId) === String(selectedStore))?.name;

  return (
    <ProtectedRoute role="buyer">
      <Layout title="">
        <Box
          mb={6}
          p={{ base: 5, md: 8 }}
          rounded="2xl"
          bgGradient="linear(135deg, teal.500, teal.700)"
          color="white"
          shadow="md"
        >
          <HStack justify="space-between" align="start" flexWrap="wrap" spacing={4}>
            <Box>
              <Text fontSize="sm" opacity={0.9} letterSpacing="wide" textTransform="uppercase">
                Neighborhood pickup shop
              </Text>
              <Text fontSize={{ base: "2xl", md: "3xl" }} fontWeight="bold" mt={1}>
                {storeName || "Sari-Sari Store"}
              </Text>
              <Text mt={2} maxW="480px" opacity={0.95}>
                Browse products, chat the seller, then pick up your order at the shop. No delivery —
                just reserve and collect.
              </Text>
            </Box>
            <Button
              as={NextLink}
              href="/buyer/cart"
              leftIcon={<AddIcon />}
              bg="white"
              color="teal.700"
              _hover={{ bg: "teal.50" }}
            >
              Pickup cart ({cartCount})
            </Button>
          </HStack>
        </Box>

        <HStack mb={6} spacing={4} flexWrap="wrap" align="end">
          <FormControl maxW="220px">
            <FormLabel fontSize="sm">Store</FormLabel>
            <Select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)}>
              {stores.map((s) => (
                <option key={s.storeId} value={s.storeId}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl maxW="180px">
            <FormLabel fontSize="sm">Category</FormLabel>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl maxW="260px">
            <FormLabel fontSize="sm">Search</FormLabel>
            <HStack>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or barcode"
              />
              <IconButton aria-label="Search" icon={<SearchIcon />} />
            </HStack>
          </FormControl>
        </HStack>

        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={5}>
          {filtered.map((p) => (
            <Box
              key={p.id}
              bg="white"
              rounded="xl"
              shadow="sm"
              overflow="hidden"
              borderWidth="1px"
              borderColor="gray.100"
              transition="transform 0.15s, box-shadow 0.15s"
              _hover={{ transform: "translateY(-2px)", shadow: "md" }}
              cursor="pointer"
              onClick={() => openProduct(p)}
            >
              {p.imageUrl ? (
                <Image src={p.imageUrl} alt={p.name} h="160px" w="full" objectFit="cover" />
              ) : (
                <Box
                  h="160px"
                  bg="orange.50"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text color="orange.300" fontWeight="bold">
                    Sari-Sari
                  </Text>
                </Box>
              )}
              <VStack p={4} align="stretch" spacing={2}>
                <Text fontWeight="bold" noOfLines={2} minH="48px">
                  {p.name}
                </Text>
                {p.description && (
                  <Text fontSize="sm" color="gray.500" noOfLines={2}>
                    {p.description}
                  </Text>
                )}
                <HStack justify="space-between">
                  <Badge colorScheme="purple">{p.category}</Badge>
                  <Text fontWeight="bold" color="teal.600">
                    ₱{p.unitPrice.toFixed(2)}
                  </Text>
                </HStack>
                <Text fontSize="sm" color={p.currentStock === 0 ? "red.500" : "gray.500"}>
                  {p.currentStock === 0 ? "Out of stock" : `${p.currentStock} in store`}
                </Text>
                <HStack onClick={(e) => e.stopPropagation()}>
                  <Button
                    flex="1"
                    size="sm"
                    colorScheme="teal"
                    leftIcon={<AddIcon />}
                    onClick={() => addToCart(p)}
                    isDisabled={p.currentStock === 0}
                  >
                    Add for pickup
                  </Button>
                  <IconButton
                    size="sm"
                    aria-label="Ask seller"
                    icon={<ChatIcon />}
                    variant="outline"
                    colorScheme="orange"
                    onClick={() => openInquire(p)}
                  />
                </HStack>
              </VStack>
            </Box>
          ))}
          {filtered.length === 0 && (
            <Text color="gray.500" gridColumn="1 / -1" textAlign="center" py={10}>
              No products match your filters
            </Text>
          )}
        </SimpleGrid>

        <Modal isOpen={detailModal.isOpen} onClose={detailModal.onClose} isCentered size="lg">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>{detailProduct?.name}</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {detailProduct?.imageUrl && (
                <Image
                  src={detailProduct.imageUrl}
                  alt={detailProduct.name}
                  w="full"
                  maxH="240px"
                  objectFit="cover"
                  rounded="md"
                  mb={4}
                />
              )}
              <HStack mb={2}>
                <Badge colorScheme="purple">{detailProduct?.category}</Badge>
                <Text fontWeight="bold" color="teal.600">
                  ₱{Number(detailProduct?.unitPrice || 0).toFixed(2)}
                </Text>
              </HStack>
              <Text color="gray.600" mb={3}>
                {detailProduct?.description || "No description yet."}
              </Text>
              <Text fontSize="sm" color="gray.500">
                {detailProduct?.currentStock === 0
                  ? "Out of stock"
                  : `${detailProduct?.currentStock} available for pickup`}
              </Text>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={detailModal.onClose}>
                Close
              </Button>
              <Button
                colorScheme="orange"
                variant="outline"
                mr={2}
                onClick={() => {
                  detailModal.onClose();
                  openInquire(detailProduct);
                }}
              >
                Ask seller
              </Button>
              <Button
                colorScheme="teal"
                isDisabled={!detailProduct || detailProduct.currentStock === 0}
                onClick={() => {
                  addToCart(detailProduct);
                  detailModal.onClose();
                }}
              >
                Add for pickup
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={inquireModal.isOpen} onClose={inquireModal.onClose} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Ask the seller</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Text fontSize="sm" color="gray.600" mb={3}>
                About <b>{inquireProduct?.name}</b> — pickup at the sari-sari store.
              </Text>
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} />
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={inquireModal.onClose}>
                Cancel
              </Button>
              <Button colorScheme="teal" onClick={sendInquiry} isLoading={inquiring}>
                Send inquiry
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Layout>
    </ProtectedRoute>
  );
}
