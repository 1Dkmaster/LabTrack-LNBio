# LabTrack-LNBio

Primeira versão de protótipo do sistema de rastreabilidade e verificação de equipamentos do laboratório.

## Visão geral

Este projeto implementa uma versão funcional inicial do LabTrack LNBio, com foco em:

- dashboard de indicadores;
- cadastro e listagem de equipamentos;
- histórico de atividades por equipamento;
- status público para consulta rápida;
- registro de limpeza, inspeção e manutenção;
- organização por perfil (Operador, Consulta e Administrador);
- armazenamento local em navegador para prototipagem rápida.

## Estrutura

- `index.html`: estrutura principal da interface
- `styles.css`: layout e visual do sistema
- `app.js`: regras de negócio, dados iniciais e interações

## Como executar

1. Abra a pasta do projeto no VS Code.
2. Inicie um servidor local simples, por exemplo:
   `python -m http.server 8000`
3. Acesse `http://localhost:8000` no navegador.

## Funcionalidades da versão inicial

- listagem de equipamentos por categoria;
- busca por nome, código e localização;
- painel de indicadores do laboratório;
- registro de atividades com responsável, data e status;
- aba de status público para consulta rápida;
- dados técnicos do equipamento;
- QR code visual para identificação;
- cadastro de novos equipamentos no navegador.

## Observação

Esta é uma versão de protótipo front-end, pensada para validar fluxo, UX e requisitos do laboratório antes da evolução para uma solução com backend e autenticação.
