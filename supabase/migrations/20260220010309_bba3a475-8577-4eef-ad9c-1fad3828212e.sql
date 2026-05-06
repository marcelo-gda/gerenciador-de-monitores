
-- Table to store editable info sections
CREATE TABLE public.info_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text UNIQUE NOT NULL,
  title text NOT NULL,
  emoji text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.info_sections ENABLE ROW LEVEL SECURITY;

-- Anyone approved can read
CREATE POLICY "Approved users can view info sections"
ON public.info_sections FOR SELECT
USING (is_approved(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Only admins can edit
CREATE POLICY "Admins can update info sections"
ON public.info_sections FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert info sections"
ON public.info_sections FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete info sections"
ON public.info_sections FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed with current hardcoded content
INSERT INTO public.info_sections (section_key, title, emoji, content, sort_order) VALUES
('cache', 'Valores de Cachê – Festas 2026', '💰', E'O ano de 2025 foi maravilhoso! Muita coisa nova foi implantada. Tivemos treinamento, reuniões estratégicas, opiniões foram dadas e as mudanças estão acontecendo desde então. Graças a vocês, o GDA está crescendo e os projetos estão saindo da gaveta.\n\nNovo modelo de cachê para festas normais desse ano, valorizando as capacidades de cada monitor e as funções que é capaz de exercer.\n\n📌 Festas com até 6 horas de duração:\n\n🏷️ Equipe 1️⃣\n👑 O Mestre é o Marcelo\n🌟 Monitor Pleno — R$ 45/hora\n✅ Monitor Júnior — R$ 35/hora\n☑️ Monitor Trainee — R$ 20/hora\n\n🏷️ Equipe 2️⃣\n👑 Mestre / Recreador — R$ 150/hora\n🔥 Monitor Pleno — R$ 90/hora\n✅ Monitor Júnior — R$ 35/hora\n☑️ Monitor Trainee — R$ 20/hora', 1),

('cargos', 'Cargos e Funções', '🎭', E'☑️ Trainee ("Cinza")\nEstá começando a ir às festas ou tem pouca experiência. Precisa aprender um pouco de cada área, o que exigirá bastante observação, atenção e ajuda da parte experiente da equipe. Quando mostrar desenvoltura e proatividade, avançará para Júnior.\n\n✅ Júnior\nTem bagagem, é proativo e seguro, conseguindo exercer a maioria das funções. Não possui premissa de coordenação. Recebe instruções do Pleno e do Mestre.\n\n🌟🔥 Pleno\nMembro escalado com mais experiência, criatividade, liderança. Coordena todos os processos do evento. Responsabilidades incluem: conferir cards, definir sequência de cenas, carregar bolsas, definir horários de lanche, separar fantasias, distribuir equipamentos, delegar funções à equipe.\nO valor do Pleno 🔥 da Equipe 2️⃣ é superior por apoiar intensamente o Mestre como Vice-Mestre.\n\n👑 Mestre\nResponsável por conduzir toda a recreação: desenvolver roteiro, reunir e controlar a turma, contar a história introdutória, estar em cena fazendo papéis principais, puxar Parabéns, entregar cards, conversar com pais e enviar avaliação pós-festa.', 2),

('bonus', 'Bônus por Função', '⭐', E'🅿️ Protagonista\n10% extra (mensal). Conhecimento amplo da história, capacidade de segurar cena sozinho. Aprovados: Rodrigo, Délcio, Venuto, Thi Vaz, Pepê.\n\n🎥 Mídia\nValor do Júnior. Responsável exclusivamente por fotos, vídeos, entrevistas e 1 story/hora.\n\n📜 Cronista\nR$ 15 extra (por festa). Mídia + funções de monitor. Responsável por registro no Notion do GDA.\n\n🫡 Sentinela\nR$ 50 extra (no mês). Disponível em 70%+ das festas do mês, por pelo menos 10, escalado em mínimo 2.', 3),

('transporte', 'Transporte', '🚗', E'Sempre que possível, pegue carona e evite Uber. Dê preferência ao ônibus.\n\n• Valor máximo por viagem (ida ou volta): R$ 15. Excedente por conta do monitor.\n• Carro próprio: R$ 15/dia (Zona Sul e Nova Lima). Lugares distantes: R$ 1,00/km.\n• Quilometragem conta saída de casa → retorno (sem desvios).\n• Uber: use bom senso, divida com colegas.\n\n⚠️ Chegada com no mínimo 10 minutos de antecedência é obrigatória.', 4),

('pagamento', 'Pagamentos', '💳', E'Cachês pagos até dia 10 do mês seguinte, condicionados ao envio das contas nos primeiros dias do mês para o telefone do GDA.\n\n✉️ 1ª Mensagem – Modelo:\nFui Escalado para:\n- 05/2 4h Noite - 👑2️⃣600+🚗R$15\n- 06/2 3h Noite - ✅2️⃣105+📜15\n- 15/2 3h Tarde – ✅1️⃣105+🅿️10,5\n- 18/2 4h Tarde – 🔥2️⃣360+🚗R$15\n...\n🫡Sentinela – 16/27 entradas na escala.\n💰 Total: R$ 4159,50\n\n✉️ 2ª Mensagem:\nChave do PIX sozinha (para facilitar o copiar e colar 😄)', 5),

('eventos-longos', 'Eventos Maiores de 6h', '🏕️', E'Em eventos longos (8h, 12h ou vários dias), o valor da hora é reduzido na negociação. Mais monitores são necessários, dividindo mais o valor.\n\nEventos como GDC têm custo operacional alto (cozinha, ônibus, espaço, alimentação, material).\n\nO que compensa é o cachê somado de várias diárias.\n\nSe o valor não estiver explícito na escala, solicite no telefone do GDA.', 6);
