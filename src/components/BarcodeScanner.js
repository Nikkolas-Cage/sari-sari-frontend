import {
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

/**
 * ZXing barcode/QR scanner — camera live scan or JPG/PNG upload.
 * Compatible formats with JsBarcode CODE128 (and QR).
 */
export default function BarcodeScanner({ onDetected, onClose }) {
  const toast = useToast();
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const [mode, setMode] = useState("camera");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onCloseRef.current = onClose;
  }, [onDetected, onClose]);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      if (mode !== "camera") return;
      setBusy(true);
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (result && active) {
            const text = result.getText();
            onDetectedRef.current?.(text);
            toast({ title: "Barcode scanned", description: text, status: "success", duration: 2000 });
            controls?.stop();
            onCloseRef.current?.();
          }
        });
        controlsRef.current = controls;
      } catch (err) {
        toast({
          title: "Camera unavailable",
          description: err.message || "Allow camera access or use JPG upload",
          status: "error",
        });
      } finally {
        setBusy(false);
      }
    }

    startCamera();

    return () => {
      active = false;
      try {
        controlsRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, [mode, toast]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const result = await reader.decodeFromImageElement(img);
      URL.revokeObjectURL(url);
      const text = result.getText();
      onDetectedRef.current?.(text);
      toast({ title: "Barcode read from image", description: text, status: "success" });
      onCloseRef.current?.();
    } catch {
      toast({
        title: "Could not read barcode",
        description: "Try a clearer CODE128 / QR image",
        status: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <VStack align="stretch" spacing={3}>
      <HStack>
        <Button
          size="sm"
          colorScheme={mode === "camera" ? "teal" : "gray"}
          onClick={() => setMode("camera")}
        >
          Camera
        </Button>
        <Button
          size="sm"
          colorScheme={mode === "upload" ? "teal" : "gray"}
          onClick={() => setMode("upload")}
        >
          Upload JPG
        </Button>
      </HStack>

      {mode === "camera" ? (
        <Box rounded="md" overflow="hidden" bg="black" minH="220px">
          <video ref={videoRef} style={{ width: "100%", maxHeight: 280 }} muted playsInline />
          <Text fontSize="xs" color="white" p={2} bg="blackAlpha.700">
            Point at a CODE128 or QR barcode…
          </Text>
        </Box>
      ) : (
        <FormControl>
          <FormLabel>Upload barcode image</FormLabel>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/webp"
            onChange={handleFile}
            p={1}
          />
        </FormControl>
      )}

      <Button variant="ghost" onClick={onClose} isDisabled={busy}>
        Cancel
      </Button>
    </VStack>
  );
}
