type Server = import("socket.io").Server
type Namespace = import("socket.io").Namespace

type Logger = (msg: string) => void

type Module = (io: Server, tower_name: string, logger: Logger) => any
