import { AddressInfo } from "net";

export interface WarpgateAddr {
  serviceName: string;
  peerId: string;
}

export interface HostAddr extends AddressInfo {
  /**
   * @default "TCP"
   */
  proto?: "UDP" | "TCP";
}

export type ForwardId = string;
export type ForwardRuleId = string;

export function isWarpgateAddr(p: unknown): p is WarpgateAddr {
  return (
    typeof (p as WarpgateAddr).peerId === "string" &&
    typeof (p as WarpgateAddr).serviceName === "string"
  );
}

export function isHostAddr(p: unknown): p is HostAddr {
  const v = p as HostAddr;
  return (
    typeof v.address === "string" &&
    typeof v.family === "string" &&
    typeof v.port === "number" &&
    (typeof v.proto === "undefined" || v.proto === "TCP" || v.proto === "UDP")
  );
}
