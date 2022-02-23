--[[
    Auto execute script

    Author: https://github.com/PrintedScript
    Github Repo: https://github.com/PrintedScript/nodebloxremake

    Tested with:
        - Synapse X
]]

repeat task.wait(0.2) until game:IsLoaded() and game:GetService("Players") and game:GetService("Players").LocalPlayer

local RefreshRate = 20 -- Interval in seconds for checking for any new scripts
local HostServer = "ws://localhost:48825" -- Host server to listen to
local UnattendedMode = true -- Disable rendering, volume and CoreGui

local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")
local ReplicatedFirst = game:GetService("ReplicatedFirst")
local StarterGui = game:GetService("StarterGui")
local Players = game:GetService("Players")

local LocalPlayer = Players.LocalPlayer

if UnattendedMode then
    UserSettings():GetService("UserGameSettings").MasterVolume = 0
	settings():GetService("RenderSettings").QualityLevel = Enum.QualityLevel.Level01
	RunService:Set3dRenderingEnabled(false)
	ReplicatedFirst:RemoveDefaultLoadingScreen()
    StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.All, false)
end


local Websocket = syn.websocket.connect(HostServer)
print("[ NodeBloxRemake ] Connected to websocket: ",HostServer)

local function GenerateClientInfo()
    local payload = {
        ["username"] = LocalPlayer.Name,
        ["placeid"] = game.PlaceId,
        ["jobid"] = game.JobId
    }
    local jsonencoded = HttpService:JSONEncode(payload)
    return syn.crypt.base64.encode(jsonencoded)
end

local function ScriptThread(scriptstring,scriptGUID)
    local success, script = pcall(loadstring(scriptstring))
    if not success then
        print("[ NodeBloxRemake ] Error occured while running script: ",scriptGUID)
        Websocket:Send("scripterror "..scriptGUID)
    end
end

local IsLoadingScript = false
local ScriptData = ""
local LoadingScriptGUID

Websocket.OnMessage:Connect(function(message)

    if IsLoadingScript then
        ScriptData += message
        return
    end

    if message == "noclientinfo" then
        Websocket:Send("sendclientinfo "..GenerateClientInfo())
    elseif message == "scriptguidcode" then
        LoadingScriptGUID = message:split(" ")[2]
    elseif message == "scriptchunk_start" then
        ScriptData = ""
        IsLoadingScript = true
    elseif message == "scriptchunk_end" then
        IsLoadingScript = false
        ScriptThread(ScriptData,LoadingScriptGUID)
    end
end)

task.wait(2)
print(GenerateClientInfo())
Websocket:Send("sendclientinfo "..GenerateClientInfo())

while true do
    if not IsLoadingScript then
        Websocket:Send("sendscript")
    end
    
    task.wait(RefreshRate)
end
