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
' Ejecuta npm start en la carpeta del servidor
' El 0 significa: ventana OCULTA
shell.Run "cmd /c cd /d C:\Proyectos\sistema-gestion-entrada && npm start", 0, False

' Pequeña pausa para que el servidor arranque
WScript.Sleep 3000

' ============================================
' 2. INICIAR AGENTE LECTOR DE CÉDULAS
' ============================================
' Ejecuta node agente.js en la carpeta del agente
shell.Run "cmd /c cd /d C:\Proyectos\agente-lector-cedulas && node agente.js", 0, False

' Salir sin mostrar nada