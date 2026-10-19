#!/usr/bin/env python3
"""DGTE R2 ideal models and conditional scenarios; no hardware/power prediction.

Standard library only. Prints JSON, writes no files, starts no arena or network call.
Reproduction: python calculate.py [--self-test] [--power-w 1 --hours-day 8 ...]
"""
import argparse
import json
import math

R = 8.314462618
G = 9.81
P_REF = 101325.0
T_REF = 309.21801777809947
L_REF = 25790.0
CP_G = 130.0
CP_L = 167.19
V_L = 0.0721488 / 620.0


def finite_nonnegative(**values):
    for key, value in values.items():
        if not math.isfinite(value) or value < 0:
            raise ValueError(f'{key} must be finite and nonnegative')


def monthly(power_w, hours_day, days, fraction, price):
    finite_nonnegative(power_w=power_w, hours_day=hours_day, days=days,
                       fraction=fraction, price=price)
    if hours_day > 24 or fraction > 1:
        raise ValueError('hours_day <= 24 and fraction <= 1 required')
    energy = power_w / 1000 * hours_day * days * fraction
    return dict(net_power_assumed_W=power_w, hours_day=hours_day, days=days,
                operating_fraction=fraction, price_assumed_EUR_kWh=price,
                energy_kWh=energy, gross_energy_value_EUR=energy * price,
                evidence='CONDITIONAL_SCENARIO; not a DGTE measurement or profit')


def capsule_train(n=40, diameter=.04, length=.12, expansion=.125,
                  rho=850., speed=.4):
    finite_nonnegative(n=n, diameter=diameter, length=length,
                       expansion=expansion, rho=rho, speed=speed)
    vc = math.pi * diameter ** 2 / 4 * length
    dv = vc * expansion
    return dict(N_all_capsules=n, Vcold_m3=vc, external_DeltaV_m3=dv,
                ideal_mechanical_W=n * rho * G * speed * dv / 2,
                assumptions='same constant bath density, constant leg states; no dwell/losses')


def pressure(mass=.1, expansion=.11, rho=900., dp=50e5,
             work_to_electric=.3, period=900., aux=.005):
    finite_nonnegative(mass=mass, expansion=expansion, rho=rho, dp=dp,
                       work_to_electric=work_to_electric, period=period, aux=aux)
    if rho == 0 or period == 0 or work_to_electric > 1:
        raise ValueError('rho and period > 0; work_to_electric <= 1 required')
    dv = mass / rho * expansion
    w = dp * dv
    e = w * work_to_electric - aux * period
    return dict(nominal_DeltaV_m3=dv, rectangle_mechanical_J=w,
                conditional_electric_before_aux_J=w * work_to_electric,
                conditional_net_J=e, conditional_net_average_W=e / period,
                evidence='KINEMATIC_BUDGET_ONLY; actual stroke under pressure and reset OPEN')


def hl(t, p):
    return CP_L * (t - T_REF) + V_L * (p - P_REF)


def sl(t):
    return CP_L * math.log(t / T_REF)


def hg(t):
    return L_REF + CP_G * (t - T_REF)


def sg(t, p):
    return L_REF / T_REF + CP_G * math.log(t / T_REF) - R * math.log(p / P_REF)


def gibbs_difference(t, p):
    return hg(t) - t * sg(t, p) - hl(t, p) + t * sl(t)


def bisect(func, lo, hi):
    flo, fhi = func(lo), func(hi)
    if flo * fhi > 0:
        raise ValueError('Root is not bracketed')
    for _ in range(100):
        mid = (lo + hi) / 2
        fm = func(mid)
        if fm == 0:
            return mid
        if flo * fm <= 0:
            hi = mid
        else:
            lo, flo = mid, fm
    return (lo + hi) / 2


def vapor_surrogate():
    """R2 VS: ideal vapor, incompressible liquid, isentropic vertical legs."""
    th, tc, height, rho, volume = 333.15, 298.15, 4., 1000., .001
    pb = P_REF + rho * G * height
    n = pb * volume / (R * th)
    t4 = th * (P_REF / pb) ** (R / CP_G)
    qh = n * (hg(th) - hl(tc, pb))
    qc = n * (hg(t4) - hl(tc, P_REF))
    w = n * (CP_G * (th - t4) - V_L * (pb - P_REF))
    return dict(evidence='CONSISTENT_IDEAL_SURROGATE; not real-fluid validation',
                H_m=height, hot_bottom_volume_L=1., Th_K=th, Tc_K=tc,
                ideal_mechanical_J=w, Qhot_J=qh, Qcold_J=qc,
                first_law_residual_J=qh-qc-w,
                Sgen_J_K=qc/tc-qh/th, eta_ideal=w/qh,
                top_vapor_volume_L=n*R*t4/P_REF*1000)


def stationary_surrogate():
    """R2 VP: compression, hot isobar, cold isochore, condensation isobar."""
    th, tc = 333.15, 298.15
    ph = bisect(lambda p: gibbs_difference(th, p), 1e5, 3e5)
    pc = bisect(lambda p: gibbs_difference(tc, p), .3e5, 1e5)
    v3, vgc = R * th / ph, R * tc / pc
    quality = (v3 - V_L) / (vgc - V_L)
    n = .001 / v3
    u3 = hg(th) - ph * v3
    u4 = ((1-quality) * (hl(tc, pc) - pc*V_L)
          + quality * (hg(tc) - pc*vgc))
    qh = n * (hg(th) - hl(tc, ph))
    q34 = n * (u4 - u3)
    q41 = -n * quality * (hg(tc) - hl(tc, pc))
    qc = -q34 - q41
    w = n * (ph-pc) * (v3-V_L)
    return dict(evidence='SAME_IDEAL_SURROGATE; alternative cycle to VS',
                hot_volume_L=1., Th_K=th, Tc_K=tc, ph_abs_bar=ph/1e5,
                pc_abs_bar=pc/1e5, quality_after_cooling=quality,
                ideal_mechanical_J=w, Qhot_J=qh, Qcold_J=qc,
                first_law_residual_J=qh-qc-w, Sgen_J_K=qc/tc-qh/th,
                eta_ideal=w/qh)


def coupled_gas(height=20., th=363.15, tc=298.15):
    if height < 0 or th < tc or tc <= 0:
        raise ValueError('Require H >= 0 and Th >= Tc > 0')
    pb = P_REF + 1000*G*height
    nr = pb * .001 / th
    lr = math.log(pb/P_REF)
    qreset = nr*3.5*(th-tc)
    qh = nr*th*lr + qreset
    qc = nr*tc*lr + qreset
    w = nr*(th-tc)*lr
    zmin = max(0., min(height, (tc*1000*G*height-(th-tc)*P_REF)
                      / ((th+tc)*1000*G)))
    cum = nr*(th*math.log(pb/(pb-1000*G*zmin))
              - tc*math.log((P_REF+1000*G*zmin)/P_REF))
    return dict(H_m=height, Th_K=th, Tc_K=tc, ideal_mechanical_J=w,
                Qhot_J=qh, Qcold_J=qc, first_law_residual_J=qh-qc-w,
                Sgen_J_K=qc/tc-qh/th,
                minimum_reversible_buffer_J=max(0., -cum),
                evidence='IDEAL_GAS_NO_REGEN; opposed elevations z and H-z; reset/losses OPEN')


def self_test():
    a = monthly(1, 24, 30, 1, .2)
    b = monthly(1, 8, 30, 1, .2)
    assert math.isclose(a['energy_kWh'], .72)
    assert math.isclose(b['gross_energy_value_EUR'], .048)
    assert math.isclose(a['energy_kWh'], 3*b['energy_kWh'])
    assert monthly(1, 24, 30, 0, .2)['energy_kWh'] == 0
    assert capsule_train(expansion=0)['ideal_mechanical_W'] == 0
    assert 1.25 < capsule_train()['ideal_mechanical_W'] < 1.27
    assert pressure(aux=.05)['conditional_net_J'] < 0
    assert pressure(dp=0, aux=0)['conditional_net_J'] == 0
    assert abs(coupled_gas(th=300, tc=300)['ideal_mechanical_J']) < 1e-12
    assert coupled_gas(height=0)['ideal_mechanical_J'] == 0
    for case in [vapor_surrogate(), stationary_surrogate(), coupled_gas()]:
        assert abs(case['first_law_residual_J']) < 1e-8
        assert case['Sgen_J_K'] >= 0
        assert 0 < case['ideal_mechanical_J']/case['Qhot_J'] < 1-case['Tc_K']/case['Th_K']
    assert math.isclose(vapor_surrogate()['ideal_mechanical_J'], 45.302077872, abs_tol=1e-7)
    assert math.isclose(stationary_surrogate()['ideal_mechanical_J'], 135.992106476, abs_tol=1e-7)
    for args in [(1, 25, 30, 1, .2), (1, 8, 30, 2, .2), (float('nan'), 8, 30, 1, .2)]:
        try:
            monthly(*args)
        except ValueError:
            pass
        else:
            raise AssertionError('Invalid scenario accepted')
    return 'PASS: energy closure, entropy, Carnot, zero-gradient, units, scenarios and guards'


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--power-w', type=float)
    ap.add_argument('--hours-day', type=float, default=24.)
    ap.add_argument('--days', type=float, default=30.)
    ap.add_argument('--fraction', type=float, default=1.)
    ap.add_argument('--price', type=float, default=.2)
    ap.add_argument('--self-test', action='store_true')
    args = ap.parse_args()
    if args.self_test:
        print(self_test())
    result = (monthly(args.power_w, args.hours_day, args.days, args.fraction, args.price)
              if args.power_w is not None else
              dict(version='dgte-advisor-1.0.0', evidence='IDEAL_MODELS_NOT_HARDWARE',
                   capsule_train=capsule_train(), PCM_pressure_budget=pressure(),
                   vapor_VS=vapor_surrogate(), stationary_VP=stationary_surrogate(),
                   coupled_gas_GC=coupled_gas()))
    print(json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2))


if __name__ == '__main__':
    main()
