# GAIA em tela dedicada (quiosque)

Modo quiosque = o navegador abre **em tela cheia, sem barras**, direto no GAIA, e o computador liga já nele. É o que você quer para o projetor.

## 1. Preparar (uma vez)

```bash
npm run install:all
npm run build
cp backend/.env.example backend/.env     # coloque a chave do Gemini em GEMINI_API_KEY
```

Precisa do Node 22 ou mais novo.

## 2. Abrir em tela cheia

- **Linux:** `./scripts/iniciar-gaia.sh`
- **Windows:** dê dois cliques em `scripts\iniciar-gaia.bat`

Os dois sobem o backend (se ainda não estiver rodando) e abrem o Chrome/Chromium/Edge em `--kiosk`. Para sair: `Alt+F4`.

## 3. Ligar sozinho com o computador

- **Windows:** `Win+R` → `shell:startup` → coloque ali um atalho para `iniciar-gaia.bat`.
- **Linux (ambiente gráfico):** adicione `iniciar-gaia.sh` aos "Aplicativos de inicialização". Para só o backend subir em segundo plano, use `scripts/gaia.service` (instruções dentro do arquivo).

Dica: nas configurações de energia do computador, desligue "suspender" e "apagar a tela". O GAIA também pede ao navegador para manter a tela acesa.

## 4. Instalar como app (PWA)

Sem usar os scripts: abra `http://127.0.0.1:8787` no Chrome/Edge → menu ⋮ → **Instalar GAIA**. Ele vira um app com ícone, em tela cheia. No celular (Chrome Android) é a mesma coisa e funciona com a página `/captura` para anotar por voz.

## 5. Acessar de outro aparelho (celular, iPad)

Por padrão o GAIA só responde neste computador. Para abrir de outro aparelho, use uma rede privada (Tailscale, por exemplo) e defina `GAIA_TOKEN` no `backend/.env`. O GAIA recusa abrir na rede sem senha.

## 6. Atualizar

```bash
git pull        # ou substitua a pasta pelo novo zip (não apague backend/data nem backend/.env)
npm run install:all && npm run build
```

Reinicie o backend. Seus dados ficam em `backend/data/` e são preservados.

## 7. Backup e restauração

- O GAIA cria **um backup por dia** em `backend/data/backups/` (guarda os 7 últimos).
- Na aba **Ajustes** você baixa tudo em JSON, as memórias em Markdown ou o banco inteiro.
- **Restaurar:** pare o GAIA, copie um `gaia-AAAA-MM-DD.sqlite` de `backups/` por cima de `backend/data/gaia.sqlite` e inicie de novo.

## Se estiver lento

Aba **Ajustes → Desempenho**: “Automático” já liga o modo leve se a máquina não passar de ~28 quadros por segundo. “Sempre leve” é o mais econômico para netbooks. A tecla `L` alterna na hora.
