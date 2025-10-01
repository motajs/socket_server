
回退了版本 `"socket.io": "^2.4.1"`, 修复了下`var temp = socket.connected[Object.keys(room.sockets)[0]];`的bug`socket->tower`, 不然之前的塔都跑不了...
> 旧版的`socket.join(id)`就会创建好`tower.adapter.rooms[id]`, 新版的行为改变了, 以及可能有更多不兼容现象

# 通用2玩家对战

引入 /general2p/xxx 来支持一般性的2人游戏, 使得新增游戏无需更改服务器

hyperDiffusion 用来测试, 该游戏可以用 /general2p/hyperDiffusion 来进行

http://127.0.0.1:13086/play.html?url=http://127.0.0.1:5050/general2p/hyperDiffusion

https://zhaouv.github.io/HyperDiffusionChess/play.html?url=https://h5mota.com:5050/general2p/hyperDiffusion

特殊需求仍需手写

## 交互逻辑以及数据流向

分为匹配和直接指定房间, 以及先后玩家和观战者

第一个玩家a 第二个玩家b 服务器s 观战者c

对战预设board : 第一个玩家第一局先手还是后手 游戏随机种子 棋盘大小 等等  
游戏设置condition : 每一局具体的游戏的设置 第一个玩家本局先手还是后手 随机种子的当前值 等等  
盘面局势position : 当前的状态信息, 用于给观战者复现局面  
当前落子square : 最新一步的动作, 由回合玩家发起(可能是连着很多步,可以每步发一个square)  

id: 1代表先手 0代表后手 2代表系统 小于0代表观战者   
(每开新的一局, 角色id可以变的)

主体逻辑如下:

1. 玩家a 连接服务器s 发送对战预设board a-s发送 'join' room board  
    其中room 0代表匹配, 非零直接指定房间.  
    board形如[id, ...], 可以包含其他数据, 例如随机种子.  
    此处id必须是1或0, 代表希望自己第一句先手还是后手  
2. 玩家b 连接服务器s 发送对战预设board b-s发送 'join' room board  
    玩家b发的board会被丢弃
    此时服务器统计等待人数到达2, 将两人移出等待房, 产生非零的随机room
3. 服务器s组织局面发送对战开始指令  
    s-a发送 'start', room, board  
    s-b发送 'start', room, _board_  
    _board_ 是 board的id变成1-id  
4. 玩家a和b给服务器s发送 'ready' room condition  
    玩家b发的condition会被丢弃  
    服务器会计数直到都发送了ready, 重置ready计数  
    新的一局开始(分出胜负/认输求和等完成后也是重发 'ready' room condition 开新对局)
5. 服务器s发送对局开始指令  
    s-a/b/c发送 'ready', condition  
    房间内所有人收到的都是来自a的condition, 因此需要结合'start'时收到的id处理
6. 玩家a或b给服务器s发送落子, 服务器s推给另一玩家  
    a(或者b)-s发送 'put', room, square  
    square形如[playerid, ...], playerid是该玩家在该局中是先手还是后手(不是第一个还是第二个玩家!)  
    同时也应该包含一个类似xy或pos的足够表述具体动作的信息  
    s给room内所有人(包括a自己以及观战者c)发送 'put', square  
    
对局是否结束由玩家a和b判定, 需要开新局直接跳到`4.`发'ready'  
服务器s不检查对局是否结束了, 收到2ready就新起一局  
也不检查ab是否冒充对方的id发了个put  

其他部分:

+ `4.` 开始后观战者开始有机会加入对局 通过c-s发送 'join' room board  
    此时服务器会发送s-c 'start', room, _board_  
    和s-c 'position', position  
    此处的_board_ 是 来自a的board并且id变成-1  
+ `5.` 服务器收到两个'ready'新起一局时,会把position设置为`[condition]`  
    此后`6.`每收到一个'put'会把那个square追加到position后  
    形如`position=[condition,square,square ... ,square]`  
    这个position在每次'put'后通过 s-c 'position', position  
    发送给所有人, 但是只有观战者需要处理  
    一般情况下condition也只有观战者需要处理, ab的随机种子或别的信息  
    在一开始board一致后, 本质上不需要通过condition也是同步的  
+ 'msg'会被直接原样发给房间内所有玩家以及观战者  
    例如 a-s 'msg' room [1,0,'hello']  
    那么s-a s-b s-c都会发送 'msg' [1,0,'hello']  
    格式形如[id, 类型, ...(文本或其他数据)]  
    类型0对应文本消息  
    类型0之外的内容由客户端自行约定实现, 可以用来实现认输求和等交互  
    注意所有会影响盘面的东西只能通过'put'的square传递, 'msg'不用于此用途  
    (服务器s不检查ab是否冒充对方的id发了个认输)  
    > 例如假设约定类型1是认输  
    > a发 'msg' room [1,1], 然后直接'ready' room condition  
    > 服务器转发'msg' [1,1]到b, b收到后发'ready' room condition  
    > 服务器累计收到两个'ready', 新开一局, 给ab发'ready' condition
+ 'error'是只有服务器会给客户端发送的 s-? 'error' reason, 此时直接结束联机
