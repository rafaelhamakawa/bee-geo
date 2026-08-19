# GeoApis

Aplicação responsiva para gestão de apiários e estimativa do potencial de pasto apícola em um raio de 1,5 km.

O projeto foi criado no [Lovable](https://lovable.dev) e continua editável no projeto conectado: https://lovable.dev/projects/a646e156-50d7-4602-8fe1-95a2c04bdc47

## Funcionalidades do MVP

- cadastro, login, recuperação de senha e perfil com Supabase Auth;
- cadastro e histórico de apiários por usuário;
- localização por coordenadas, geolocalização e Google Maps;
- círculo fixo de 1,5 km, equivalente a 706,86 ha;
- registro de múltiplos fragmentos de pasto apícola;
- cálculo transparente do percentual de cobertura e da capacidade de colmeias;
- multiplicadores por bioma/vegetação e fator de segurança de 0,85;
- modo de demonstração claramente identificado;
- banco com Row Level Security: cada usuário acessa apenas os próprios dados.

## Cálculo

```text
área do círculo = π × 1,5² × 100 = 706,8583 ha
1% do círculo = 7,0686 ha
percentual de pasto = área de pasto ÷ 7,0686
capacidade bruta = percentual × multiplicador da vegetação
capacidade recomendada = piso(capacidade bruta × 0,85)
```

O arredondamento final é sempre para baixo, preservando o caráter conservador da recomendação.

## Configuração local

```sh
npm install
cp .env.example .env.local
npm run dev
```

Preencha no ambiente de implantação:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_GEO_ANALYSIS_URL` quando o serviço MapBiomas/Earth Engine estiver publicado
- `VITE_ENABLE_DEMO_MODE=false` para desabilitar a demonstração em produção

Não coloque `service_role`, chave privada do Earth Engine nem qualquer segredo com prefixo `VITE_`: variáveis Vite são públicas no navegador.

## Banco de dados

Aplique a migração em `supabase/migrations/20260819000000_geoapis_schema.sql` pelo Supabase CLI ou pelo fluxo de migrations do Lovable. Ela cria:

- `profiles`
- `apiaries`
- `analyses`
- `pasture_fragments`
- políticas RLS, relacionamentos e validações

## Análise geoespacial

O Google Maps é usado somente para exibir o mapa, selecionar a localização e desenhar o círculo. A classificação da vegetação deve ser feita em serviço separado com dados de cobertura do solo, preferencialmente MapBiomas no Google Earth Engine.

Enquanto esse serviço não estiver conectado, o aplicativo oferece delimitação manual dos fragmentos e mantém todo o cálculo funcional. Monoculturas floríferas e Acácia Mangium sempre devem ser confirmadas pelo usuário, pois não podem ser determinadas apenas pelo bioma.

## Verificação

```sh
npm run typecheck
npm test
npm run build
```

## Sincronização com o Lovable

O histórico publicado não deve ser reescrito. Alterações integradas à branch `main` aparecem no editor do Lovable.
