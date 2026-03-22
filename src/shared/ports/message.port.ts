import type { MessageType, RequestMap, ResponseMessage } from "../types/messages";

export type SendMessage = <T extends MessageType>(
	...args: RequestMap[T] extends undefined ? [type: T] : [type: T, payload: RequestMap[T]]
) => Promise<ResponseMessage<T>>;
