import re

with open('src/views/PosView.tsx', 'r') as f:
    content = f.read()

# We want to replace the block starting at `/* OPSI RUMUS RESEP PENJUALAN DROPDOWN & FORM */`
# and ending right before `// Realtime Split Preview` or similar. Let's find the exact bounds.

start_marker = "/* OPSI RUMUS RESEP PENJUALAN DROPDOWN & FORM */"
end_marker = "{/* Realtime Split Preview */}"

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    new_content = content[:start_idx] + """/* PENGATURAN RESEP (MARKUP & RACIKAN) */
                      <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <label className="font-extrabold text-indigo-950 text-[11px] flex items-center gap-1.5">
                            <Calculator className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            Pengaturan Harga Resep
                          </label>
                        </div>

                        <div className="space-y-2 pt-1 border-t border-indigo-200/60">
                          <div className="flex items-center justify-between text-[11px]">
                            <label className="font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={useCustomPrescriptionSettings}
                                onChange={e => setUseCustomPrescriptionSettings(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              Ubah Markup & Biaya Racikan Khusus Transaksi Ini
                            </label>
                          </div>

                          {useCustomPrescriptionSettings ? (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <label className="block text-slate-500 mb-1">Markup (%)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={customMarkupRate}
                                  onChange={e => setCustomMarkupRate(Number(e.target.value))}
                                  className="w-full px-2 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-indigo-900"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-1">Biaya Racikan (Rp)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={customRacikanFee}
                                  onChange={e => setCustomRacikanFee(Number(e.target.value))}
                                  className="w-full px-2 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-indigo-900"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="p-2 bg-indigo-100/50 rounded-lg text-[10px] space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-600">Markup Default:</span>
                                <strong className="text-indigo-900">{settings.defaultPrescriptionMarkup || 20}%</strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Biaya Racikan Default:</span>
                                <strong className="text-indigo-900">{formatRupiah(settings.defaultRacikanFee || 0)}</strong>
                              </div>
                            </div>
                          )}
                        </div>

                        """ + content[end_idx:]
    
    with open('src/views/PosView.tsx', 'w') as f:
        f.write(new_content)
    print("Successfully updated PosView.tsx")
else:
    print("Markers not found.")

