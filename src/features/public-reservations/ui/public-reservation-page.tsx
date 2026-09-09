import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  FormFeedback,
  Input,
  useFormFeedback,
} from "@doscientos/ui";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Check, Clock3, MapPin, Users } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import {
  createPublicReservation,
  getPublicReservationAvailability,
  type PublicReservationProfile,
} from "../application/public-reservations";

const weekdayNames = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

function localDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(
    date,
  );
}

function nextDates(weekday: number): string[] {
  const today = new Date();
  const result: string[] = [];
  for (let offset = 0; offset < 30 && result.length < 8; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    if (date.getDay() === weekday) result.push(localDateKey(date));
  }
  return result;
}

function slotsForService(
  service: PublicReservationProfile["services"][number],
): string[] {
  const [startHour = 0, startMinute = 0] = service.startsAtTime
    .slice(0, 5)
    .split(":")
    .map(Number);
  const [endHour = 0, endMinute = 0] = service.endsAtTime
    .slice(0, 5)
    .split(":")
    .map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const slots: string[] = [];
  for (let minute = start; minute < end; minute += service.slotMinutes) {
    slots.push(
      `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
    );
  }
  return slots;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00`));
}

export function PublicReservationPage({
  profile,
}: {
  profile: PublicReservationProfile;
}) {
  const feedback = useFormFeedback();
  const [serviceId, setServiceId] = useState(profile.services[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [managementToken, setManagementToken] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const service = profile.services.find(
    (candidate) => candidate.id === serviceId,
  );
  const dates = useMemo(
    () => (service ? nextDates(service.weekday) : []),
    [service],
  );
  const slots = useMemo(
    () => (service ? slotsForService(service) : []),
    [service],
  );

  function selectService(id: string) {
    setServiceId(id);
    setDate("");
    setTime("");
    setAvailableSlots([]);
  }

  async function selectDate(value: string, size = partySize) {
    setDate(value);
    setTime("");
    if (!value || !service) {
      setAvailableSlots([]);
      return;
    }
    setAvailabilityLoading(true);
    try {
      const result = await getPublicReservationAvailability({
        data: {
          date: value,
          partySize: size,
          serviceId: service.id,
          slug: profile.slug,
        },
      });
      setAvailableSlots(result);
    } catch {
      setAvailableSlots([]);
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!service || !date || !time) {
      feedback.setError("Elige el día y la hora que prefieras.");
      return;
    }
    feedback.setPending();
    try {
      const result = await createPublicReservation({
        data: {
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          guestName,
          partySize,
          serviceId,
          slug: profile.slug,
          // The browser's local zone is the restaurant's zone in this MVP. The
          // server validates the instant again against the tenant timezone.
          startsAt: new Date(`${date}T${time}:00`).toISOString(),
        },
      });
      setManagementToken(result.managementToken);
      setConfirmed(true);
      feedback.setSuccess("");
    } catch (error) {
      feedback.setError(
        error instanceof Response && error.status === 409
          ? "Esta hora acaba de ocuparse. Elige otra, por favor."
          : "No hemos podido completar la reserva. Revisa los datos e inténtalo de nuevo.",
      );
    }
  }

  if (confirmed) {
    return (
      <main className="relative grid min-h-svh place-items-center overflow-hidden bg-[#fbfaf8] p-[clamp(1rem,4vw,3.5rem)]">
        <section
          aria-labelledby="booking-confirmed"
          className="relative z-10 w-full max-w-[34rem] rounded-3xl border border-[#292d34]/10 bg-white/92 p-[clamp(2rem,7vw,5rem)] text-center shadow-[0_1.5rem_4rem_rgb(66_48_35_/_12%)]"
        >
          <span
            aria-hidden="true"
            className="inline-grid size-16 place-items-center rounded-full bg-[#21835b] text-white"
          >
            <Check className="size-7" />
          </span>
          <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[#c34d3e] uppercase">
            Reserva recibida
          </p>
          <h1
            id="booking-confirmed"
            className="mt-4 text-[clamp(2.25rem,6vw,4rem)] leading-[0.95] font-[650] tracking-[-0.075em] text-[#292d34]"
          >
            Te esperamos en {profile.name}
          </h1>
          <p className="mt-6 leading-relaxed text-[#60656d]">
            Hemos reservado una mesa para {partySize}{" "}
            {partySize === 1 ? "persona" : "personas"} el {formatDate(date)} a
            las {time}.
          </p>
          <Link
            className="st-public-booking-manage-link"
            params={{ token: managementToken }}
            to="/reserva/$token"
          >
            Consultar o cancelar esta reserva
          </Link>
          <p className="mt-6 text-xs leading-5 text-[#737983]">
            {profile.venueName}. Guarda esta pantalla; pronto podrás añadir
            confirmaciones y recordatorios.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-[#fbfaf8] p-[clamp(1rem,4vw,3.5rem)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-72 -right-32 size-[32rem] rounded-full bg-[#f8c4a6] opacity-45 blur-xl motion-reduce:blur-none"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-88 -left-48 size-[32rem] rounded-full bg-[#d6e8d6] opacity-45 blur-xl motion-reduce:blur-none"
      />
      <section className="relative z-10 grid w-full max-w-[68rem] items-center gap-[clamp(1.5rem,5vw,5rem)] min-[800px]:grid-cols-[minmax(0,1fr)_minmax(24rem,32rem)]">
        <header className="max-w-lg">
          <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[#c34d3e] uppercase">
            Reserva directa
          </p>
          <h1 className="m-0 text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.95] font-[650] tracking-[-0.075em] text-[#292d34]">
            {profile.name}
          </h1>
          <p className="mt-5 max-w-sm text-[clamp(1.05rem,2vw,1.3rem)] leading-6 text-[#60656d]">
            Elige tu momento. Nosotros nos ocupamos de preparar la mesa.
          </p>
          <div className="mt-8 grid gap-2.5 text-sm text-[#737983]">
            <span className="inline-flex items-center gap-2">
              <MapPin aria-hidden="true" className="size-4" />{" "}
              {profile.venueName}
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock3 aria-hidden="true" className="size-4" /> Reserva en menos
              de un minuto
            </span>
          </div>
        </header>
        <Card className="w-full max-w-lg border-[#292d34]/10 bg-white/92 shadow-[0_1.5rem_4rem_rgb(66_48_35_/_12%)] backdrop-blur-[12px]">
          <CardHeader>
            <CardTitle>Encuentra tu mesa</CardTitle>
            <CardDescription>
              {profile.services.length > 0
                ? "No necesitas crear una cuenta."
                : "Este restaurante todavía no ha publicado ningún turno disponible."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(event) => void submit(event)}
            >
              <Field>
                <FieldLabel htmlFor="public-service">Momento</FieldLabel>
                <select
                  id="public-service"
                  className="min-h-12 bg-white"
                  onChange={(event) => selectService(event.target.value)}
                  value={serviceId}
                >
                  {profile.services.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} · {weekdayNames[candidate.weekday]}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="public-date">
                    <CalendarDays
                      aria-hidden="true"
                      className="mr-1 inline size-4"
                    />{" "}
                    Día
                  </FieldLabel>
                  <select
                    id="public-date"
                    className="min-h-12 bg-white"
                    onChange={(event) => void selectDate(event.target.value)}
                    required
                    value={date}
                  >
                    <option value="">Selecciona un día</option>
                    {dates.map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {formatDate(candidate)}
                      </option>
                    ))}
                  </select>
                  {date &&
                  !availabilityLoading &&
                  availableSlots.length === 0 ? (
                    <p className="mt-2 text-xs text-[#c34d3e]">
                      No quedan horas libres para ese día y número de personas.
                    </p>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="public-time">Hora</FieldLabel>
                  <select
                    id="public-time"
                    className="min-h-12 bg-white"
                    onChange={(event) => setTime(event.target.value)}
                    required
                    value={time}
                  >
                    <option value="">Selecciona una hora</option>
                    {(date ? availableSlots : slots).map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {candidate}
                      </option>
                    ))}
                  </select>
                  {availabilityLoading ? (
                    <p
                      aria-live="polite"
                      className="text-muted-foreground mt-2 text-xs"
                    >
                      Buscando horas disponibles…
                    </p>
                  ) : null}
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="public-party">
                  <Users aria-hidden="true" className="mr-1 inline size-4" />{" "}
                  Personas
                </FieldLabel>
                <Input
                  id="public-party"
                  className="min-h-12"
                  max={50}
                  min={1}
                  onChange={(event) => {
                    const nextSize = Number(event.target.value);
                    setPartySize(nextSize);
                    if (date) void selectDate(date, nextSize);
                  }}
                  required
                  type="number"
                  value={partySize}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="public-name">Tu nombre</FieldLabel>
                  <Input
                    autoComplete="name"
                    id="public-name"
                    onChange={(event) => setGuestName(event.target.value)}
                    required
                    value={guestName}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="public-phone">Teléfono</FieldLabel>
                  <Input
                    autoComplete="tel"
                    id="public-phone"
                    inputMode="tel"
                    onChange={(event) => setPhone(event.target.value)}
                    required
                    value={phone}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="public-email">Email (opcional)</FieldLabel>
                <Input
                  autoComplete="email"
                  id="public-email"
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  value={email}
                />
              </Field>
              <FormFeedback
                pendingLabel="Comprobando disponibilidad…"
                state={feedback.state}
              />
              <Button
                className="w-full"
                disabled={
                  feedback.pending ||
                  availabilityLoading ||
                  profile.services.length === 0 ||
                  Boolean(date && availableSlots.length === 0)
                }
                size="lg"
                type="submit"
              >
                Reservar mesa
              </Button>
              <p className="m-0 text-xs leading-5 text-[#737983]">
                Al reservar, tus datos se compartirán solo con {profile.name}{" "}
                para gestionar esta reserva.
              </p>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
