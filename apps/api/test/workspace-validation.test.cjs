const test = require("node:test");
const assert = require("node:assert/strict");
const { ValidationPipe } = require("@nestjs/common");
const { CreateGoalDto } = require("../dist/goals/dto/create-goal.dto");
const { UpdateGoalDto } = require("../dist/goals/dto/update-goal.dto");
const { ProgressService } = require("../dist/progress/progress.service");

for (const metatype of [CreateGoalDto, UpdateGoalDto]) {
  test(metatype.name + " validates the normalized title", async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    const metadata = { type: "body", metatype };
    await assert.rejects(pipe.transform({ title: "  x  " }, metadata));
    assert.equal((await pipe.transform({ title: "  Learn algebra  " }, metadata)).title, "Learn algebra");
  });
}

test("changing task status preserves a reflection unless explicitly replaced", async () => {
  const row = { reflection: "My saved notes" };
  const query = {
    select() { return this; },
    eq() { return this; },
    maybeSingle: async () => ({ data: { id: "task" } }),
    upsert(values) { Object.assign(row, values); return this; },
    single: async () => ({ data: row }),
  };
  const req = { user: { id: "learner" }, supabase: { from: () => query } };
  const input = { path_item_id: "task", status: "completed" };
  const service = new ProgressService();
  await service.save(req, input);
  assert.equal(row.reflection, "My saved notes");
  await service.save(req, { ...input, reflection: "" });
  assert.equal(row.reflection, "");
});

test("paginated reads include every row and reject an incomplete response", async () => {
  const { readAllPages } = require("../dist/common/read-all-pages");
  const rows = Array.from({ length: 1080 }, (_, i) => ({ id: String(i).padStart(4, "0") }));
  const result = await readAllPages((after, limit) => Promise.resolve({
    data: rows.filter(row => !after || row.id > after).slice(0, limit), error: null,
  }), "Unable to load rows");
  assert.deepEqual(result, rows);
  await assert.rejects(readAllPages(after => Promise.resolve(after
    ? { error: new Error("offline"), data: null }
    : { error: null, data: rows.slice(0, 500) }), "Unable to load rows"), /Unable to load rows/);
});

test("a real single-page PDF reaches the knowledge ingestion boundary as readable text", async () => {
  const { AiService } = require("../dist/ai/ai.service");
  const service = new AiService({});
  service.ingest = async (_req, input) => input;
  const sentence = "Each variable represents a value that can change over time.";
  const stream = "BT /F1 12 Tf 40 700 Td (" + sentence + ") Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = ["0000000000 65535 f "];
  objects.forEach((object, index) => {
    offsets.push(String(pdf.length).padStart(10, "0") + " 00000 n ");
    pdf += (index + 1) + " 0 obj\n" + object + "\nendobj\n";
  });
  const xref = pdf.length;
  pdf += "xref\n0 6\n" + offsets.join("\n") + "\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  const result = await service.ingestDocument({}, { originalname: "variables.pdf", mimetype: "application/pdf", buffer: Buffer.from(pdf), size: pdf.length });
  assert.equal(result.title, "variables");
  assert.equal(result.content, sentence);
});
