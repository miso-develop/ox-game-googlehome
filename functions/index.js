//init
const dialogflow = require("actions-on-google").DialogflowApp
const functions = require("firebase-functions")
const admin = require("firebase-admin")
admin.initializeApp(functions.config().firebase)
const db = admin.database()
const moment = require("moment")

//log
const l = v => console.log(v)



//
exports.dialogflowtest = functions.https.onRequest((request, response) => {
    //console.log("Request headers: " + JSON.stringify(request.headers))
    //console.log("Request body: " + JSON.stringify(request.body))
    
    const app = new dialogflow({request, response})
    response.setHeader("Content-Type", "application/json")
    
    const ref = db.ref("/ox/0000")
    let tell = ""
    let sync = {
        host: "",
        guest: "",
        timestamp: 0,
        turn: -1,
        judgment: -1,
        board: [],
    }
    
    
    
    //初期化
    const init = () => {
        //ゲーム内容初期化
        initGame()
        
        //timestamp
        sync.timestamp = moment(new Date).format("YYYY/MM/DD HH:mm:ss")
        //id生成
        sync.host = String(Math.random()).substr(2, 8)
        //DB更新
        ref.set(sync)
        
        //tell
        tell += "マルバツゲームを開始します。" + parseOX(sync.turn) + "が先攻です。"
        
        //comの番だったら
        if (sync.turn == 1) comPut()
        
        //response
        response.send(
            JSON.stringify({
                "speech": tell, "displayText": tell
            })
        )
    }
    
    //ゲーム内容初期化
    const initGame = () => {
        sync.board = [
            [3, 3, 3, 3, 3],
            [3, 2, 2, 2, 3],
            [3, 2, 2, 2, 3],
            [3, 2, 2, 2, 3],
            [3, 3, 3, 3, 3]
        ]
        sync.turn = Math.round(Math.random())
        sync.judgment = -1
    }
    
    
    
    //com
    const comPut = () => {
        //置く場所ランダムに
        const x = randomRange(1, 3)
        const y = randomRange(1, 3)
        //置けるかチェック
        if (sync.board[x][y] != 2) {comPut(); return}
        //tell
        tell += xy2direction([x, y]) + "に置きました。"
        //put
        put(x, y)
    }
    
    //ユーザ操作
    const userPut = () => {
        //Dialogflow Parameter
        const direction = app.getArgument("direction")
        //場所を配列に変換
        const xy = direction2xy(direction)
        
        //DB情報取得
        ref.once("value", function(snapshot) {
            //情報更新
            sync = snapshot.val()
            
            //put
            if (put(xy[0], xy[1])) comPut()
            
            //response
            response.send(
                JSON.stringify({
                    "speech": tell, "displayText": tell
                })
            )
        })
    }
    
    //put
    const put = (x, y) => {
        //置けるかチェック
        if (!checkPut(x, y)) return false
        //マーク付け
        sync.board[x][y] = sync.turn
        //勝敗判定
        sync.judgment = judge(x, y)
        //ターン交代
        sync.turn = 1 - sync.turn
        //DB更新
        ref.set(sync)
        
        //dbg
        //lBoard()
        
        //終了判定
        if (gemaSet()) return false
        
        //
        return true
    }
    
    //置けるかチェック
    const checkPut = (x, y) => {
        //空白以外を押しても処理せず
        if (sync.board[x][y] != 2) {
            tell += "そこには置けません！"
            return false
        }
        return true
    }
    
    //勝敗判定
    const judge = (x, y) => {
        //勝敗判定
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx == 0 && dy == 0) continue
                let count = 0
                let k = 1
                while (sync.board[x + k * dx][y + k * dy] <= 1) {
                    if (sync.board[x + k * dx][y + k * dy] == sync.turn) {
                        k = 1
                        while (sync.board[x + k * dx][y + k * dy] == sync.turn) {
                            count++
                            k++
                        }
                        k = 1
                        while (sync.board[x + -k * dx][y + -k * dy] == sync.turn) {
                            count++
                            k++
                        }
                        break
                    }
                    k++
                }
                if (count == 2) return sync.turn
            }
        }
        //押す場所がなくなった判定
        if (sync.board.join("").indexOf(2) == -1) return 2
        //上記以外
        return -1
    }
    
    //終了判定
    const gemaSet = () => {
        //既定値なら何もせず
        if (sync.judgment == -1) return
        
        //勝敗出力
        switch(sync.judgment) {
            case 0: tell += "あなたの勝ちです！"; break
            case 1: tell += "わたしの勝ちです！"; break
            case 2: tell += "引き分けです！"
        }
        
        //初期化
        initGame()
        //DBも初期化
        ref.set(sync)
        
        //tell
        tell += "次のゲームを始めます。" + parseOX(sync.turn) + "が先攻です。"
        
        //comの番だったら
        if (sync.turn == 1) comPut()
        
        return true
    }
    
    
    
    //場所を配列に変換
    const direction2xy = direction => {
        return ({
            upleft: [1, 1],
            up: [1, 2],
            upright: [1, 3],
            left: [2, 1],
            center: [2, 2],
            right: [2, 3],
            downleft: [3, 1],
            down: [3, 2],
            downright: [3, 3],
        })[direction]
    }
    
    //配列を場所名に変換
    const xy2direction = xy => {
        return ({
            11: "左上",
            12: "上",
            13: "右上",
            21: "左",
            22: "真ん中",
            23: "右",
            31: "左下",
            32: "下",
            33: "右下",
        })[xy.join("")]
    }
    
    //turn情報を呼び名変換
    const parseOX = val => {
        if (val == 0) return "あなた"
        if (val == 1) return "わたし"
    }
    
    //指定範囲の値をランダムに返す
    const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)
    
    
    
    //dbg
    const lBoard = () => {
        let result = ""
        for (let i = 1; i < 4; i++) {
            for (let j = 1; j < 4; j++) {
                result += ({
                    0: "x",
                    1: "o",
                    2: ".",
                })[sync.board[i][j]]
            }
            result += "\n"
        }
        l(result)
    }
    
    
    
    //function map
    let actionMap = new Map()
    actionMap.set("init", init)
    actionMap.set("userPut", userPut)
    app.handleRequest(actionMap)
})
