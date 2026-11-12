import { describe, expect, it } from "vitest";
import { DEFAULT_DRIVER_RULES as R, driverProblems, vehicleProblems, withDefaultRules } from "@/domain/driver-rules";

const now = new Date("2026-11-10T12:00:00");
const ok = { birthDate: new Date("1990-05-10"), cnhCategory: "B", cnhFirstLicenseAt: new Date("2012-03-01"), cnhExpiresAt: new Date("2029-12-31"), ear: true };

describe("requisitos do motorista", () => {
  it("aceita quem cumpre tudo", () => expect(driverProblems(ok, R, now)).toEqual([]));
  it("idade mínima conta o aniversário", () => {
    // Meio-dia, como o servidor faz: data sem hora vira meia-noite em UTC, que no Brasil ainda é o dia anterior.
    expect(driverProblems({ ...ok, birthDate: new Date("2005-11-11T12:00:00") }, R, now).join()).toContain("21 anos");
    expect(driverProblems({ ...ok, birthDate: new Date("2005-11-09T12:00:00") }, R, now)).toEqual([]);
  });
  it("CNH: categoria A ou B (ou superior), EAR, validade e tempo de habilitação", () => {
    expect(driverProblems({ ...ok, cnhCategory: "A" }, R, now)).toEqual([]);
    expect(driverProblems({ ...ok, cnhCategory: "ACC" }, R, now).join()).toContain("categoria A");
    expect(driverProblems({ ...ok, cnhCategory: "AE" }, R, now)).toEqual([]);
    expect(driverProblems({ ...ok, ear: false }, R, now).join()).toContain("EAR");
    expect(driverProblems({ ...ok, cnhExpiresAt: new Date("2026-11-01") }, R, now).join()).toContain("vencida");
    expect(driverProblems({ ...ok, cnhFirstLicenseAt: new Date("2026-06-01") }, R, now).join()).toContain("1 ano");
  });
  it("as regras do painel valem", () => {
    expect(driverProblems({ ...ok, birthDate: new Date("2007-01-01") }, { ...R, minAge: 18 }, now)).toEqual([]);
  });
});

describe("requisitos do carro", () => {
  const car = { year: 2020, doors: 4, seats: 5, airConditioning: true };
  it("aceita carro dentro das regras", () => expect(vehicleProblems(car, R, now)).toEqual([]));
  it("recusa velho demais, 2 portas, poucos lugares e sem ar", () => {
    expect(vehicleProblems({ ...car, year: 2013 }, R, now).join()).toContain("2014");
    expect(vehicleProblems({ ...car, doors: 2 }, R, now).join()).toContain("portas");
    expect(vehicleProblems({ ...car, seats: 4 }, R, now).join()).toContain("lugares");
    expect(vehicleProblems({ ...car, airConditioning: false }, R, now).join()).toContain("ar-condicionado");
    expect(vehicleProblems({ ...car, airConditioning: false }, { ...R, requireAirConditioning: false }, now)).toEqual([]);
  });
  it("carro exige CNH B ou superior", () => {
    expect(vehicleProblems(car, R, now, { cnhCategory: "A", cnhFirstLicenseAt: new Date("2012-03-01") }).join()).toContain("categoria B");
    expect(vehicleProblems(car, R, now, { cnhCategory: "AB", cnhFirstLicenseAt: new Date("2012-03-01") })).toEqual([]);
  });
});

describe("requisitos da moto (mototáxi)", () => {
  const moto = { year: 2021, doors: 0, seats: 1, airConditioning: false, kind: "moto" as const, motoGear: true };
  const cnhA = { cnhCategory: "A", cnhFirstLicenseAt: new Date("2015-01-10T12:00:00") };
  it("aceita moto dentro das regras, sem pedir portas nem ar", () => expect(vehicleProblems(moto, R, now, cnhA)).toEqual([]));
  it("exige categoria A, 2 anos de habilitação, equipamentos e idade máxima", () => {
    expect(vehicleProblems(moto, R, now, { ...cnhA, cnhCategory: "B" }).join()).toContain("categoria A");
    expect(vehicleProblems(moto, R, now, { ...cnhA, cnhFirstLicenseAt: new Date("2025-06-01T12:00:00") }).join()).toContain("2 anos");
    expect(vehicleProblems({ ...moto, motoGear: false }, R, now, cnhA).join()).toContain("colete");
    expect(vehicleProblems({ ...moto, year: 2014 }, R, now, cnhA).join()).toContain("2016");
  });
  it("regras salvas antes da moto ganham os valores padrão", () => {
    const { motoMinLicenseYears: _a, maxMotoAge: _b, ...old } = R;
    expect(withDefaultRules(old).motoMinLicenseYears).toBe(2);
    expect(withDefaultRules({ ...old, minAge: 25 }).minAge).toBe(25);
  });
});
