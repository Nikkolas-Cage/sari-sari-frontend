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
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Textarea,
  useDisclosure,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import BarcodeScanner from "@/components/BarcodeScanner";
import BarcodeExport from "@/components/BarcodeExport";
import { api } from "@/lib/api";
import { subscribeRealtime } from "@/lib/realtime";
import { AddIcon, DeleteIcon, DownloadIcon, ViewIcon } from "@chakra-ui/icons";

const CATEGORIES = ["Snacks", "Beverages", "Canned Goods", "Personal Care", "Household", "Other"];

const emptyForm = {
  name: "",
  description: "",
  category: "Snacks",
  unitPrice: "",
  currentStock: "",
  barcode: "",
  lowStockThreshold: "5",
  imageUrl: "",
};

export default function SellerProducts() {
  const toast = useToast();
  const fileRef = useRef();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const stockModal = useDisclosure();
  const scanModal = useDisclosure();
  const exportModal = useDisclosure();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [stockQty, setStockQty] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportProduct, setExportProduct] = useState(null);

  async function loadProducts() {
    const params = showLowStockOnly ? { lowStock: "true" } : {};
    const data = await api.getProducts(params);
    setProducts(data.products);
  }

  useEffect(() => {
    loadProducts().catch(console.error);
  }, [showLowStockOnly]);

  useEffect(() => {
    return subscribeRealtime((msg) => {
      if (!msg?.type?.startsWith("product:")) return;
      loadProducts().catch(console.error);
    });
  }, [showLowStockOnly]);

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleBarcodeLookup(code) {
    if (!code) return;
    try {
      const { product } = await api.getProductByBarcode(code);
      setForm((prev) => ({
        ...prev,
        name: product.name,
        category: product.category,
        unitPrice: String(product.unitPrice),
        barcode: product.barcode || code,
      }));
      toast({ title: "Product found", status: "success", duration: 2000 });
    } catch {
      updateForm("barcode", code);
    }
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateForm("imageUrl", reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const unitPrice = Number(form.unitPrice);
    const currentStock = Number(form.currentStock);
    const lowStockThreshold = Number(form.lowStockThreshold);

    if (!form.name.trim()) {
      toast({ title: "Product name is required", status: "warning" });
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      toast({ title: "Enter a valid unit price", status: "warning" });
      return;
    }
    if (!Number.isFinite(currentStock) || currentStock < 0) {
      toast({ title: "Enter initial stock (0 or more)", status: "warning" });
      return;
    }

    setLoading(true);
    try {
      await api.createProduct({
        name: form.name.trim(),
        description: form.description || "",
        category: form.category,
        barcode: form.barcode || null,
        imageUrl: form.imageUrl || null,
        unitPrice,
        currentStock,
        lowStockThreshold: Number.isFinite(lowStockThreshold) && lowStockThreshold > 0 ? lowStockThreshold : 5,
      });
      toast({ title: "Product registered", status: "success" });
      setForm({ ...emptyForm });
      if (fileRef.current) fileRef.current.value = "";
      await loadProducts();
    } catch (err) {
      toast({ title: err.message, status: "error" });
    } finally {
      setLoading(false);
    }
  }

  function openStockModal(product) {
    setSelectedProduct(product);
    setStockQty(1);
    stockModal.onOpen();
  }

  async function handleAddStock() {
    try {
      await api.addStock(selectedProduct.id, stockQty);
      toast({ title: "Stock updated", status: "success" });
      stockModal.onClose();
      await loadProducts();
    } catch (err) {
      toast({ title: err.message, status: "error" });
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this product?")) return;
    try {
      await api.deleteProduct(id);
      toast({ title: "Product deleted", status: "success" });
      await loadProducts();
    } catch (err) {
      toast({ title: err.message, status: "error" });
    }
  }

  return (
    <ProtectedRoute role="seller">
      <Layout title="Product Inventory">
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8}>
          <Box bg="white" p={6} rounded="lg" shadow="sm">
            <Text fontWeight="bold" mb={4}>
              Register Product
            </Text>
            <form onSubmit={handleSubmit}>
              <VStack spacing={3} align="stretch">
                <FormControl>
                  <FormLabel>Barcode / SKU (CODE128)</FormLabel>
                  <HStack>
                    <Input
                      placeholder="Scan or type barcode"
                      value={form.barcode}
                      onChange={(e) => updateForm("barcode", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleBarcodeLookup(form.barcode);
                        }
                      }}
                    />
                    <IconButton
                      aria-label="Scan barcode"
                      icon={<ViewIcon />}
                      onClick={scanModal.onOpen}
                    />
                  </HStack>
                </FormControl>
                {form.barcode && <BarcodeExport value={form.barcode} productName={form.name || "product"} />}
                <FormControl isRequired>
                  <FormLabel>Name</FormLabel>
                  <Input value={form.name} onChange={(e) => updateForm("name", e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    value={form.description}
                    onChange={(e) => updateForm("description", e.target.value)}
                    placeholder="Short product details for buyers"
                    rows={3}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Category</FormLabel>
                  <Select value={form.category} onChange={(e) => updateForm("category", e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Unit Price (₱)</FormLabel>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.unitPrice}
                    onChange={(e) => updateForm("unitPrice", e.target.value)}
                    placeholder="0.00"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Initial Stock</FormLabel>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    value={form.currentStock}
                    onChange={(e) => updateForm("currentStock", e.target.value)}
                    placeholder="e.g. 20"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Low Stock Threshold</FormLabel>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    value={form.lowStockThreshold}
                    onChange={(e) => updateForm("lowStockThreshold", e.target.value)}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Product Image</FormLabel>
                  <Input type="file" accept="image/*" ref={fileRef} onChange={handleImageUpload} />
                  {form.imageUrl && (
                    <Image src={form.imageUrl} alt="Preview" maxH="100px" mt={2} rounded="md" />
                  )}
                </FormControl>
                <Button type="submit" colorScheme="teal" isLoading={loading}>
                  Register Product
                </Button>
              </VStack>
            </form>
          </Box>

          <Box bg="white" p={6} rounded="lg" shadow="sm">
            <HStack justify="space-between" mb={4}>
              <Text fontWeight="bold">Product List</Text>
              <Button
                size="sm"
                variant={showLowStockOnly ? "solid" : "outline"}
                colorScheme={showLowStockOnly ? "red" : "gray"}
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              >
                {showLowStockOnly ? "Show All" : "Low Stock Only"}
              </Button>
            </HStack>
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Category</Th>
                    <Th>Barcode</Th>
                    <Th isNumeric>Price</Th>
                    <Th isNumeric>Stock</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {products.map((p) => {
                    const isLow = p.currentStock < p.lowStockThreshold;
                    return (
                      <Tr key={p.id} bg={isLow ? "red.50" : undefined}>
                        <Td>
                          <HStack>
                            {p.imageUrl && <Image src={p.imageUrl} boxSize="32px" rounded="md" />}
                            <Box>
                              {p.name}
                              {isLow && (
                                <Badge ml={2} colorScheme="red">
                                  Low
                                </Badge>
                              )}
                            </Box>
                          </HStack>
                        </Td>
                        <Td>{p.category}</Td>
                        <Td fontSize="xs">{p.barcode || "—"}</Td>
                        <Td isNumeric>₱{p.unitPrice.toFixed(2)}</Td>
                        <Td isNumeric>{p.currentStock}</Td>
                        <Td>
                          <HStack>
                            <IconButton
                              size="xs"
                              aria-label="Export barcode"
                              icon={<DownloadIcon />}
                              isDisabled={!p.barcode}
                              onClick={() => {
                                setExportProduct(p);
                                exportModal.onOpen();
                              }}
                            />
                            <IconButton
                              size="xs"
                              aria-label="Add stock"
                              icon={<AddIcon />}
                              onClick={() => openStockModal(p)}
                            />
                            <IconButton
                              size="xs"
                              colorScheme="red"
                              variant="ghost"
                              aria-label="Delete"
                              icon={<DeleteIcon />}
                              onClick={() => handleDelete(p.id)}
                            />
                          </HStack>
                        </Td>
                      </Tr>
                    );
                  })}
                  {products.length === 0 && (
                    <Tr>
                      <Td colSpan={6} textAlign="center" color="gray.500">
                        No products yet
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </Box>
        </SimpleGrid>

        <Modal isOpen={scanModal.isOpen} onClose={scanModal.onClose} isCentered size="lg">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Scan barcode</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <BarcodeScanner
                onDetected={(code) => {
                  updateForm("barcode", code);
                  handleBarcodeLookup(code);
                }}
                onClose={scanModal.onClose}
              />
            </ModalBody>
          </ModalContent>
        </Modal>

        <Modal isOpen={exportModal.isOpen} onClose={exportModal.onClose} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Export barcode — {exportProduct?.name}</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <BarcodeExport value={exportProduct?.barcode} productName={exportProduct?.name} />
            </ModalBody>
          </ModalContent>
        </Modal>

        <Modal isOpen={stockModal.isOpen} onClose={stockModal.onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Add Stock — {selectedProduct?.name}</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <FormControl>
                <FormLabel>Quantity to add</FormLabel>
                <NumberInput min={1} value={stockQty} onChange={(_, v) => setStockQty(v || 1)}>
                  <NumberInputField />
                </NumberInput>
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={stockModal.onClose}>
                Cancel
              </Button>
              <Button colorScheme="teal" onClick={handleAddStock}>
                Add Stock
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Layout>
    </ProtectedRoute>
  );
}
