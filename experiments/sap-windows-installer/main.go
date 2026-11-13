package main

import (
 "archive/zip"
 "bytes"
 _ "embed"
 "fmt"
 "io"
 "os"
 "os/exec"
 "path/filepath"
 "strings"
 "syscall"
 "time"
 "unsafe"
)

// The workflow embeds the reviewed extension ZIP in this executable.
//go:embed pont-sap-extension.zip
var extensionZIP []byte

const version = "0.1.1"

var (
 user32 = syscall.NewLazyDLL("user32.dll")
 kernel32 = syscall.NewLazyDLL("kernel32.dll")
 shell32 = syscall.NewLazyDLL("shell32.dll")
 messageBox = user32.NewProc("MessageBoxW")
 openClipboard = user32.NewProc("OpenClipboard")
 emptyClipboard = user32.NewProc("EmptyClipboard")
 setClipboardData = user32.NewProc("SetClipboardData")
 closeClipboard = user32.NewProc("CloseClipboard")
 globalAlloc = kernel32.NewProc("GlobalAlloc")
 globalLock = kernel32.NewProc("GlobalLock")
 globalUnlock = kernel32.NewProc("GlobalUnlock")
 globalFree = kernel32.NewProc("GlobalFree")
 shellExecute = shell32.NewProc("ShellExecuteW")
)

func u16(s string) *uint16 { p, _ := syscall.UTF16PtrFromString(s); return p }

func alert(title, message string, isError bool) {
 flags := uintptr(0x40040) // MB_TOPMOST + MB_ICONINFORMATION
 if isError { flags = 0x40010 }
 messageBox.Call(0, uintptr(unsafe.Pointer(u16(message))), uintptr(unsafe.Pointer(u16(title))), flags)
}

func clipboard(text string) error {
 data, err := syscall.UTF16FromString(text)
 if err != nil { return err }
 opened := false
 for i := 0; i < 12; i++ {
  if ok, _, _ := openClipboard.Call(0); ok != 0 { opened = true; break }
  time.Sleep(80*time.Millisecond)
 }
 if !opened { return fmt.Errorf("no se ha podido abrir el portapapeles") }
 defer closeClipboard.Call()
 if ok, _, _ := emptyClipboard.Call(); ok == 0 { return fmt.Errorf("no se pudo vaciar el portapapeles") }
 size := uintptr(len(data)*2)
 handle, _, _ := globalAlloc.Call(0x0002, size) // movable global memory
 if handle == 0 { return fmt.Errorf("memoria insuficiente") }
 ptr, _, _ := globalLock.Call(handle)
 if ptr == 0 { globalFree.Call(handle); return fmt.Errorf("no se pudo preparar la memoria") }
 copy(unsafe.Slice((*uint16)(unsafe.Pointer(ptr)), len(data)), data)
 globalUnlock.Call(handle)
 if ok, _, _ := setClipboardData.Call(13,handle); ok == 0 {
  globalFree.Call(handle)
  return fmt.Errorf("no se pudo copiar la ruta")
 }
 return nil // clipboard owns the allocated memory
}

func openChrome() bool {
 for _, base := range []string{os.Getenv("PROGRAMFILES"),os.Getenv("PROGRAMFILES(X86)"),os.Getenv("LOCALAPPDATA")} {
  if base == "" { continue }
  executable := filepath.Join(base, "Google", "Chrome", "Application", "chrome.exe")
  if stat, err := os.Stat(executable); err == nil && !stat.IsDir() {
   return exec.Command(executable, "chrome://extensions/").Start() == nil
  }
 }
 verb, address, params := u16("open"),u16("chrome://extensions/"),u16("")
 result, _, _ := shellExecute.Call(0,uintptr(unsafe.Pointer(verb)),uintptr(unsafe.Pointer(address)),uintptr(unsafe.Pointer(params)),0,1)
 return result > 32
}

func prepare() (string,error) {
 root := os.Getenv("LOCALAPPDATA")
 if root == "" { return "",fmt.Errorf("no se encuentra LOCALAPPDATA") }
 path := filepath.Join(root,"ComputoAAC","PontSAPChrome","v"+version)
 required := map[string]bool{
  "manifest.json":true,"background.mjs":true,"computo-bridge.js":true,
  "portal-monitor.js":true,"probe.js":true,"protocol.mjs":true,
  "icon-16.png":true,"icon-48.png":true,"icon-128.png":true,
 }
 zr, err := zip.NewReader(bytes.NewReader(extensionZIP),int64(len(extensionZIP)))
 if err != nil { return "",err }
 if len(zr.File) != len(required) { return "",fmt.Errorf("archivo de extension incompleto") }
 if err := os.MkdirAll(path,0700); err != nil { return "",err }
 seen := make(map[string]bool)
 for _, entry := range zr.File {
  if !required[entry.Name] || seen[entry.Name] || strings.ContainsAny(entry.Name,"/\\") || entry.FileInfo().IsDir() || entry.UncompressedSize64 > 1000000 {
   return "",fmt.Errorf("archivo no permitido: %s",entry.Name)
  }
  seen[entry.Name]=true
  source,err:=entry.Open();if err!=nil {return "",err}
  content,readErr:=io.ReadAll(io.LimitReader(source,1000001))
  source.Close()
  if readErr!=nil || len(content)>1000000 { return "",fmt.Errorf("archivo invalido: %s",entry.Name) }
  target:=filepath.Join(path,entry.Name)
  if err:=os.WriteFile(target,content,0600);err!=nil{return "",err}
 }
 return path,nil
}

func main() {
 path,err:=prepare()
 if err!=nil {
  alert("Pont SAP - Error","No se ha podido preparar la extension:\n"+err.Error(),true)
  return
 }
 copied:=clipboard(path)==nil
 opened:=openChrome()
 message:="Pont SAP v"+version+" se ha preparado en tu PC.\n\n"
 if opened {message+="Chrome se ha abierto en EXTENSIONES.\n\n"} else {message+="Abre Chrome y escribe chrome://extensions/\n\n"}
 message+="1. Desactiva el Pont SAP anterior si existe.\n2. Activa MODO DESARROLLADOR.\n3. Haz clic en CARGAR DESCOMPRIMIDA.\n4. Selecciona esta carpeta:\n\n"+path+"\n\n"
 if copied {message+="La ruta ya esta copiada al portapapeles (Ctrl+V).\n\n"}
 message+="Vuelve a Còmput AAC y actualiza la pagina.\n\n"
 message+="Chrome exige estos pasos hasta que Google apruebe la extension. No se han cambiado las politicas de seguridad."
 alert("Pont SAP Windows - Instalacion de prueba",message,false)
}
