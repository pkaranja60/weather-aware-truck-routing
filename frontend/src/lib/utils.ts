import { cn as cnFn } from "cn";

export function cn(...inputs: Parameters<typeof cnFn>) {
  return cnFn(...inputs);
}
