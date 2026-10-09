# Pixel Perfect Prototype - Ponto de Sobreaviso

Sistema de ponto e gestão de sobreaviso e acionamentos (100% client-side via IndexedDB).

## Desenvolvimento

Para executar localmente, você precisa do Node.js e npm:

```sh
npm install
npm run dev
```

O app fica disponível em `http://localhost:4387`.

## Deixar rodando sempre (macOS)

No macOS, o app pode subir sozinho no login com um `LaunchAgent` (o equivalente local do `systemctl`). Rode na pasta do projeto:

```sh
npm install
npm run build

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$HOME/Library/LaunchAgents/com.pixel-perfect.app.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.pixel-perfect.app</string>
  <key>WorkingDirectory</key>
  <string>$(pwd)</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(command -v npm)</string>
    <string>run</string>
    <string>preview</string>
    <string>--</string>
    <string>--host</string>
    <string>127.0.0.1</string>
    <string>--port</string>
    <string>4387</string>
    <string>--strictPort</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$(dirname "$(command -v npm)"):/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/pixel-perfect.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/pixel-perfect-error.log</string>
</dict>
</plist>
EOF

plutil -lint "$HOME/Library/LaunchAgents/com.pixel-perfect.app.plist"

launchctl bootout "gui/$(id -u)/com.pixel-perfect.app" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.pixel-perfect.app.plist"

open http://localhost:4387
```

O `plutil` deve responder `OK`. O serviço sobe no login e o macOS reinicia o processo se ele cair.

Comandos do dia a dia:

```sh
launchctl print "gui/$(id -u)/com.pixel-perfect.app"   # ver se está rodando
launchctl bootout "gui/$(id -u)/com.pixel-perfect.app"  # parar
launchctl bootstrap "gui/$(id -u)" \
  "$HOME/Library/LaunchAgents/com.pixel-perfect.app.plist"  # iniciar de novo
```

Logs: `/tmp/pixel-perfect.log` e `/tmp/pixel-perfect-error.log`.

Depois de alterar o código, gere a build de novo e reinicie o serviço:

```sh
npm run build
launchctl kickstart -k "gui/$(id -u)/com.pixel-perfect.app"
```

Os dados ficam no IndexedDB do navegador. Acesse sempre pelo mesmo navegador e pelo mesmo endereço (`http://localhost:4387`), pois `localhost` e `127.0.0.1` armazenam dados separados.

Para remover o início automático:

```sh
launchctl bootout "gui/$(id -u)/com.pixel-perfect.app"
rm "$HOME/Library/LaunchAgents/com.pixel-perfect.app.plist"
```

Se o `npm install` falhar com `EACCES` no cache (`~/.npm`), corrija a propriedade da pasta com `sudo chown -R "$(id -u):$(id -g)" ~/.npm` e evite usar `sudo npm install`.

## Scripts

Outros scripts disponíveis:

- `npm run test`: Executa os testes automatizados com Vitest
- `npm run build`: Cria a build de produção
- `npm run lint`: Valida as regras de lint com ESLint
- `npm run format`: Formata os arquivos com Prettier
