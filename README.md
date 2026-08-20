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
- banco com Row Level Security: cada usuário acessa apenas os próprios dados;
- área administrativa protegida para consultar usuários, apiários e análises;
- edição administrativa de nome, telefone e papel da conta, sem permitir autopromoção pelo navegador.

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
- `VITE_GEO_ANALYSIS_URL` apontando para `https://<PROJECT_REF>.supabase.co/functions/v1/analyze-pasture`
- `VITE_ENABLE_DEMO_MODE=false` para desabilitar a demonstração em produção

Não coloque `service_role`, chave privada do Earth Engine nem qualquer segredo com prefixo `VITE_`: variáveis Vite são públicas no navegador.

## Banco de dados

Aplique, na ordem, as migrations em `supabase/migrations` pelo Supabase CLI, SQL Editor ou fluxo de migrations do Lovable. Elas criam:

- `profiles`, `apiaries`, `analyses` e `pasture_fragments`;
- políticas RLS, relacionamentos e validações;
- papéis `user` e `admin`;
- RPCs administrativas que validam o papel no servidor;
- proteção para impedir que um usuário comum altere o próprio papel;
- proteção para impedir a remoção do último administrador.

Depois de cadastrar e confirmar a primeira conta administrativa, execute uma vez no SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = '<EMAIL_DO_ADMIN>'
);
```

A partir do próximo login, a opção **Admin** aparecerá no menu. O painel permite consultar usuários, apiários e totais de análises, além de editar nome, telefone e papel das contas.

## Análise geoespacial

O Google Maps é usado somente para exibir o mapa, selecionar a localização e desenhar o círculo. A classificação é executada pela Edge Function `supabase/functions/analyze-pasture` com:

- MapBiomas Cobertura e Uso 10 m — Collection 3;
- banda padrão `classification_2024`;
- classes naturais 3, 4, 5, 6 e 49;
- divisão das áreas em fragmentos vetoriais;
- cálculo da área de cada fragmento em hectares;
- identificação do bioma pela camada auxiliar do MapBiomas;
- remoção de ruídos menores que 0,05 ha.

O asset, banda, ano, resolução, área mínima e camada de biomas permanecem configuráveis por secrets. Monoculturas floríferas e Acácia Mangium sempre exigem confirmação do usuário.

### Publicação da função

O projeto Google Cloud precisa estar registrado no Earth Engine e com a API ativada. Crie uma conta de serviço e armazene o JSON privado **somente** nos secrets da função.

```sh
supabase secrets set EARTH_ENGINE_PROJECT_ID=<GOOGLE_CLOUD_PROJECT_ID>
supabase secrets set EARTH_ENGINE_PRIVATE_KEY_JSON='<JSON_DA_CONTA_DE_SERVICO>'
supabase functions deploy analyze-pasture
```

Use `supabase/functions/.env.example` como referência. Nunca envie a chave privada ao GitHub, ao frontend ou ao chat do Lovable.

Enquanto a função não estiver publicada, o aplicativo mantém a delimitação manual e todos os cálculos funcionais.

## Verificação

```sh
npm run typecheck
npm test
npm run build
```

## Sincronização com o Lovable

O histórico publicado não deve ser reescrito. Alterações integradas à branch `main` aparecem no editor do Lovable.
