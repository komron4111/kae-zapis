// Простой ZIP без сжатия для резервной копии: data.json и фото.
// Фото уже сжаты (JPEG), поэтому сжимать архив нет смысла.
// Проверяется тестами в tests/.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// files: [{ name, data: Uint8Array }] → Blob с архивом.
export function makeZip(files, date = new Date()) {
  const encoder = new TextEncoder();
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const parts = [], central = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // имена в UTF-8
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    parts.push(local, name, file.data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(12, time, true);
    entry.setUint16(14, day, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, size, true);
    entry.setUint32(24, size, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(entry, name);

    offset += 30 + name.length + size;
  }
  const centralSize = central.reduce((sum, part) => sum + part.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

// Читает архив из makeZip: [{ name, blob }]. Файл целиком в память не грузится.
export async function readZip(blob) {
  const tailStart = Math.max(0, blob.size - 65557);
  const tail = new DataView(await blob.slice(tailStart).arrayBuffer());
  let end = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('Это не архив копии');
  const count = tail.getUint16(end + 10, true);
  const centralSize = tail.getUint32(end + 12, true);
  const centralStart = tail.getUint32(end + 16, true);
  const central = new DataView(await blob.slice(centralStart, centralStart + centralSize).arrayBuffer());
  const decoder = new TextDecoder();
  const entries = [];
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (central.getUint32(p, true) !== 0x02014b50) throw new Error('Архив копии повреждён');
    const method = central.getUint16(p + 10, true);
    const size = central.getUint32(p + 20, true);
    const nameLength = central.getUint16(p + 28, true);
    const extraLength = central.getUint16(p + 30, true);
    const commentLength = central.getUint16(p + 32, true);
    const localStart = central.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(central.buffer, central.byteOffset + p + 46, nameLength));
    p += 46 + nameLength + extraLength + commentLength;
    if (method !== 0) throw new Error('Архив пересжат другой программой — восстановите из исходного файла копии');
    const local = new DataView(await blob.slice(localStart, localStart + 30).arrayBuffer());
    const dataStart = localStart + 30 + local.getUint16(26, true) + local.getUint16(28, true);
    entries.push({ name, blob: blob.slice(dataStart, dataStart + size) });
  }
  return entries;
}
