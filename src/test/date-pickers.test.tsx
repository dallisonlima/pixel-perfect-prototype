import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DateTimePicker, MonthPicker } from "@/components/DatePickers";

describe("seletores de data", () => {
  it("troca o mês pelo seletor próprio", () => {
    const onChange = vi.fn();
    render(<MonthPicker value="2026-10" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /outubro de 2026/i }));
    fireEvent.click(screen.getByRole("button", { name: "Próximo ano" }));
    fireEvent.click(screen.getByRole("button", { name: "mar" }));

    expect(onChange).toHaveBeenCalledWith("2027-03");
  });

  it("troca o mês pelas setas, inclusive na virada do ano", () => {
    const onChange = vi.fn();
    const { rerender } = render(<MonthPicker value="2026-10" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(onChange).toHaveBeenCalledWith("2026-09");

    rerender(<MonthPicker value="2026-01" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(onChange).toHaveBeenCalledWith("2025-12");

    rerender(<MonthPicker value="2026-12" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(onChange).toHaveBeenCalledWith("2027-01");
  });

  it("mantém a hora ao escolher outro dia e atualiza a hora", () => {
    function Campo() {
      const [v, setV] = useState("2026-10-14T22:30");
      return (
        <>
          <DateTimePicker label="Início" value={v} onChange={setV} />
          <output>{v}</output>
        </>
      );
    }
    render(<Campo />);

    fireEvent.click(screen.getByRole("button", { name: "Início: data" }));
    fireEvent.click(screen.getByRole("button", { name: /16 de outubro/i }));
    expect(screen.getByRole("status")).toHaveTextContent("2026-10-16T22:30");

    fireEvent.change(screen.getByLabelText("Início: hora"), { target: { value: "08:05" } });
    expect(screen.getByRole("status")).toHaveTextContent("2026-10-16T08:05");
  });
});
