const WebSocketServer = require('ws').Server;
const WebsocketPort = 48825
const wss = new WebSocketServer({ port: WebsocketPort });
console.log(`Started new websocket server on port ${WebsocketPort}`);
var awaitingexecution = {}

function chunk(s, maxBytes) {
    let buf = Buffer.from(s);
    const result = [];
    while (buf.length) {
      result.push(buf.slice(0, maxBytes).toString());
      buf = buf.slice(maxBytes);
    }
    return result;
}

function uuidv4() { /* thank you stackoverflow :heart_eyes: */
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

/* if you are wondering why I randomly use + to create strings or `` to format them is because github copilot keeps autocompleting it for me so its easier  */

wss.on('connection', function NewConnection(websock, req) {
    console.log(`[!] Established connection with ${req.socket.remoteAddress}`);

    var clientinfo = null;

    websock.on('message', function message(data) {
        if ( data === 'sendclientinfo') {
            try{
                var decodedclientinfo = JSON.parse(atob(data));
                console.log(`[!] Received client info from ${req.socket.remoteAddress} | username: ${decodedclientinfo.username} | placeid: ${decodedclientinfo.placeid} | jobid: ${decodedclientinfo.jobid}`);
                clientinfo = decodedclientinfo;
                websock.send("recvclientinfo")
            } catch(e) {
                console.log(`[!] Error decoding client info: ${e} | ip: ${req.socket.remoteAddress} | data length: ${data.length}`);
                websock.send('clientinfoparsingfailed')
            }
        } else if ( data === 'sendscript') {
            if (clientinfo == null) {
                console.log(`[!] Client requested for script but has not given client info yet`)
                websock.send('noclientinfo')
            } else {
                if (awaitingexecution[clientinfo.username] != null) {
                    console.log('[!] Preparing script for execution to ' + clientinfo.username)
                    try{
                        var scriptarguments = '';
                        var index = 1
                        awaitingexecution[clientinfo.username]['scriptarguments'].array.forEach(element => {
                            scriptarguments += `NodeBloxARG_${index} = ${element}; `
                        });

                        var rawscript = `${scriptarguments}\n${awaitingexecution[clientinfo.username]['script']}`;
                        
                        console.log('[!] Sending script to ' + clientinfo.username)

                        var scriptGUID = uuidv4();

                        websock.send('scriptguidcode ' + scriptGUID)
                        websock.send('scriptchunk_start');
                        var script = chunk(rawscript, 60000)
                        script.forEach((scriptchunk) => {
                            websock.send(scriptchunk);
                        });
                        websock.send('scriptchunk_end');

                        console.log('[!] Sucessfully sent script to ' + clientinfo.username + ' | scriptGUID: ' + scriptGUID)
                    } catch(e) {
                        console.log(`[!] Error sending script to ${clientinfo.username} | ${e}`)
                    }
                    awaitingexecution[clientinfo.username] = null
                } else {
                    console.log('[!] Client requested for script but has no scripts waiting to be executed')
                    websock.send('noscript')
                }
            }
        } else if ( data.includes('reporterror')) {
            if (clientinfo == null) {
                console.log(`[!] Client attempted to report error but has not given any info on client yet`)
                websock.send('noclientinfo')
            } else {
                console.log(`[!] Client reported script error from ${clientinfo.username}, script guid: ${data.split(' ')[1]}`)
                websock.send('errorreported')
            }
        } else if ( data === 'clientclose') {
            if (clientinfo == null) {
                console.log(`[!] Closing connection to unknown client, ip: ${req.socket.remoteAddress}`)
                websock.close()
            } else {
                console.log(`[!] Closing connection to ${clientinfo.username}, ip: ${req.socket.remoteAddress}`)
                websock.close()
            }
        } else {
            console.log(`[!] Unknown message from ${req.socket.remoteAddress} | data: ${data}`)
        }
    });
});