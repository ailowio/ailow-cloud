import { useState } from 'react';
import { TextInput } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import { formatarData, hojeEmSaoPaulo } from '../lib/datas';
import { normalizarDataIso } from '../lib/data-campo';
import { Modal } from './navegacao';

/**
 * Campo de data do tema do app (UXM-10): no lugar do <input type="date"> nativo (cinza, fora da marca).
 * Valor de entrada e de saída: texto "AAAA-MM-DD" (sem Date, sem fuso). Tocar abre um pop-up com o calendário
 * em pt-BR (semana começa no domingo); tocar num dia escolhe e fecha. O campo é somente leitura: o teclado do
 * sistema nunca abre. O pop-up é o Modal do app, então o Voltar do sistema o fecha sem sair da tela.
 */
export function CampoData(props: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  required?: boolean;
  error?: string;
  /** Último dia permitido, "AAAA-MM-DD". */
  max?: string;
  /** Primeiro dia permitido, "AAAA-MM-DD". */
  min?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const valor = normalizarDataIso(props.value);

  return (
    <>
      <TextInput
        label={props.label}
        required={props.required}
        error={props.error}
        size="lg"
        readOnly
        inputMode="none"
        autoComplete="off"
        placeholder="Escolher o dia"
        value={valor ? formatarData(valor) : ''}
        rightSection={<IconCalendar size={22} aria-hidden />}
        styles={{ input: { cursor: 'pointer' } }}
        onClick={() => setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setAberto(true);
          }
        }}
      />
      <Modal
        opened={aberto}
        onClose={() => setAberto(false)}
        title="Escolher o dia"
        className="ailow-popup ailow-popup-data"
        xOffset={8}
      >
        <DatePicker
          className="ailow-data"
          size="xl"
          weekdayFormat="ddd"
          value={valor}
          defaultDate={valor ?? props.max ?? hojeEmSaoPaulo()}
          minDate={normalizarDataIso(props.min) ?? undefined}
          maxDate={normalizarDataIso(props.max) ?? undefined}
          onChange={(v) => {
            const dia = normalizarDataIso(v);
            if (!dia) return;
            props.onChange(dia);
            setAberto(false);
          }}
        />
      </Modal>
    </>
  );
}
