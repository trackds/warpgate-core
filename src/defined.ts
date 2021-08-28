export interface WarpgateAddr {
  serviceName: string;
  peerId: string;
}

export interface HostAddr {
  /**
   * @default "TCP"
   */
  proto?: "UDP" | "TCP";
  host: string;
  port: number;
}

export type ForwardId = string;
export type ForwardRuleId = string;

export function isWarpgateAddr(p: unknown): p is WarpgateAddr {
  const v = p as WarpgateAddr;
  return (
    typeof v.peerId === "string" &&
    typeof v.serviceName === "string"
  );
}

export function isHostAddr(p: unknown): p is HostAddr {
  const v = p as HostAddr;
  return (
    typeof v.host === "string" &&
    typeof v.port === "number" &&
    (typeof v.proto === "undefined" || v.proto === "TCP" || v.proto === "UDP")
  );
}
