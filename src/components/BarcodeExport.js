import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
import { DownloadIcon } from "@chakra-ui/icons";
import { useEffect, useRef } from "react";

/**
 * JsBarcode CODE128 — readable by ZXing BrowserMultiFormatReader.
 */
export default function BarcodeExport({ value, productName }) {
  const svgRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function draw() {
      if (!value || !svgRef.current) return;
      const JsBarcode = (await import("jsbarcode")).default;
      if (cancelled) return;
      try {
        JsBarcode(svgRef.current, String(value), {
          format: "CODE128",
          displayValue: true,
          fontSize: 14,
          height: 60,
          margin: 8,
        });
      } catch {
        // invalid value for CODE128
      }
    }
    draw();
    return () => {
      cancelled = true;
    };
  }, [value]);

  function downloadPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `barcode-${productName || value}.png`;
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${svg64}`;
  }

  if (!value) {
    return (
      <Text fontSize="sm" color="gray.500">
        Add a barcode to generate an exportable label.
      </Text>
    );
  }

  return (
    <VStack align="stretch" spacing={2}>
      <Box bg="white" p={3} rounded="md" borderWidth="1px" overflowX="auto">
        <svg ref={svgRef} />
      </Box>
      <HStack>
        <Button
          size="sm"
          colorScheme="teal"
          variant="outline"
          leftIcon={<DownloadIcon />}
          onClick={downloadPng}
        >
          Export barcode PNG
        </Button>
        <Text fontSize="xs" color="gray.500">
          CODE128 · ZXing compatible
        </Text>
      </HStack>
    </VStack>
  );
}
