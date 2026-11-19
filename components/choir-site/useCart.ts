"use client";

import { useCallback, useEffect, useState } from "react";
import { addLine, CART_KEY, cartCount, isCartLine, setLineQty, type CartLine } from "@/lib/choir-site/cart";

const EVENT = "csc-choir-cart";

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartLine);
  } catch {
    return [];
  }
}

function save(lines: CartLine[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event(EVENT));
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  const read = useCallback(() => {
    setLines(load());
    setReady(true);
  }, []);

  useEffect(() => {
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, [read]);

  return {
    lines,
    ready,
    count: cartCount(lines),
    add: (line: CartLine) => save(addLine(load(), line)),
    update: (key: string, qty: number) => save(setLineQty(load(), key, qty)),
    clear: () => save([]),
  };
}
