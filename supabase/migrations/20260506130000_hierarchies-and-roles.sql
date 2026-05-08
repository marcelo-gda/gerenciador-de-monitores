
-- hierarchies: níveis de monitores (Trainee → Mestre)
CREATE TABLE public.hierarchies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji text NOT NULL DEFAULT '',
  name text NOT NULL,
  slug text NOT NULL UNIQUE, -- mapeia para o valor do enum monitor_level
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO public.hierarchies (emoji, name, slug, description, sort_order) VALUES
('☑️', 'Trainee', 'trainee',
 'Está começando a ir às festas ou tem pouca experiência. Precisa aprender um pouco de cada área, o que exigirá bastante observação, atenção e ajuda da parte experiente da equipe. Quando mostrar desenvoltura e proatividade, avançará para Júnior.',
 1),
('✅', 'Júnior', 'junior',
 'Tem bagagem, é proativo e seguro, conseguindo exercer a maioria das funções. Não possui premissa de coordenação. Recebe instruções do Pleno e do Mestre.',
 2),
('🌟', 'Pleno', 'pleno',
 'Membro escalado com mais experiência, criatividade, liderança. Coordena todos os processos do evento: conferir cards, definir sequência de cenas, carregar bolsas, definir horários de lanche, separar fantasias, distribuir equipamentos, delegar funções à equipe.',
 3),
('👑', 'Mestre', 'mestre',
 'Responsável por conduzir toda a recreação: desenvolver roteiro, reunir e controlar a turma, contar a história introdutória, estar em cena fazendo papéis principais, puxar Parabéns, entregar cards, conversar com pais e enviar avaliação pós-festa.',
 4);

-- roles: funções especiais (bônus)
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji text NOT NULL DEFAULT '',
  name text NOT NULL,
  slug text NOT NULL UNIQUE, -- mapeia para os valores de bonus_tags
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO public.roles (emoji, name, slug, description, sort_order) VALUES
('🅿️', 'Protagonista', 'protagonista',
 'Conhecimento amplo da história, capacidade de segurar cena sozinho. Concede +10% mensal.',
 1),
('🎥', 'Mídia', 'midia',
 'Responsável exclusivamente por fotos, vídeos, entrevistas e 1 story/hora. Valor do Júnior.',
 2),
('📜', 'Cronista', 'cronista',
 'Mídia + funções de monitor. Responsável por registro no Notion do GDA. Concede +R$15 por festa.',
 3),
('🫡', 'Sentinela', 'sentinela',
 'Disponível em 70%+ das festas do mês, por pelo menos 10, escalado em mínimo 2. Concede +R$50 no mês.',
 4);

-- Adicionar hierarchy_id e role_id em profiles
ALTER TABLE public.profiles
  ADD COLUMN hierarchy_id uuid REFERENCES public.hierarchies(id) ON DELETE SET NULL,
  ADD COLUMN role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;

-- Adicionar hierarchy_id em team_roles (vincula cargo de equipe a uma hierarquia)
ALTER TABLE public.team_roles
  ADD COLUMN hierarchy_id uuid REFERENCES public.hierarchies(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.hierarchies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view hierarchies"
  ON public.hierarchies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can view roles"
  ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage hierarchies"
  ON public.hierarchies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage roles"
  ON public.roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
