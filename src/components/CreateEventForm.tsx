import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

interface CreateEventFormProps {
  onClose: () => void;
  onCreated: () => void;
}

const CreateEventForm = ({ onClose, onCreated }: CreateEventFormProps) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("☀️");
  const [type, setType] = useState<string>("sun");
  const [eventDate, setEventDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [address, setAddress] = useState("");
  const [totalSlots, setTotalSlots] = useState<string>("");
  const [team, setTeam] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const typeOptions = [
    { value: "sun", emoji: "☀️", label: "Tarde" },
    { value: "moon", emoji: "🌙", label: "Noite" },
    { value: "camp", emoji: "🛌🏼", label: "Acampamento" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !eventDate || !startTime || !endTime || !address) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("events").insert([{
      title,
      emoji,
      type: type as "sun" | "moon" | "camp",
      event_date: eventDate,
      end_date: type === "camp" && endDate ? endDate : null,
      start_time: startTime,
      end_time: endTime,
      address,
      total_slots: totalSlots ? parseInt(totalSlots) : null,
      team,
      created_by: user?.id,
    }]);
    if (error) {
      toast.error("Erro ao criar evento: " + error.message);
    } else {
      toast.success("Evento criado!");
      onCreated();
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg border-2 border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-card-foreground">Nova Festa</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-semibold">Nome da Festa *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Tipo</label>
            <div className="flex gap-2">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setType(opt.value); setEmoji(opt.emoji); }}
                  className={`flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition-colors ${
                    type === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`grid gap-3 ${type === "camp" ? "grid-cols-2" : "grid-cols-3"}`}>
            <div>
              <label className="mb-1 block text-sm font-semibold">{type === "camp" ? "Data Início *" : "Data *"}</label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            {type === "camp" && (
              <div>
                <label className="mb-1 block text-sm font-semibold">Data Fim *</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={eventDate} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-semibold">Início *</label>
              <input type="text" value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="14h" required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Fim *</label>
              <input type="text" value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="18h" required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Endereço *</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Equipe</label>
            <div className="flex gap-2">
              {[1, 2].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTeam(t)}
                  className={`flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition-colors ${
                    team === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {t === 1 ? "1️⃣" : "2️⃣"} Equipe {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Vagas Totais (opcional)</label>
            <input type="number" value={totalSlots} onChange={(e) => setTotalSlots(e.target.value)} min="1" max="50" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Deixe vazio para ilimitado" />
          </div>

          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
            <Plus className="h-4 w-4" />
            {loading ? "Criando..." : "Criar Festa"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateEventForm;
