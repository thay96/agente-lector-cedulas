' ============================================
'  start-server.vbs
'  Ejecuta Servidor Web + Agente Lector
'  TOTALMENTE OCULTOS (sin ventanas)
' ============================================

Dim shell
Set shell = CreateObject("WScript.Shell")

' ============================================
' 1. INICIAR SERVIDOR WEB (PUERTO 3000)
' ============================================
shell.Run "cmd /c cd /d C:\Sistema-de-entrada-Recepcion\Sistema-de-entrada-Recepcion && npm start", 0, False

' Pequeña pausa para que el servidor arranque
WScript.Sleep 3000

' ============================================
' 2. INICIAR AGENTE LECTOR DE CÉDULAS
' ============================================
shell.Run "cmd /c cd /d C:\Sistema-de-entrada-Recepcion\agente-lector-cedulas && node agente.js", 0, False

' Salir sin mostrar nada