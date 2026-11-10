-- CreateIndex
CREATE INDEX "incoming_entries_material_id_in_date_idx" ON "incoming_entries"("material_id", "in_date");

-- CreateIndex
CREATE INDEX "outgoing_transactions_incoming_entry_id_row_no_idx" ON "outgoing_transactions"("incoming_entry_id", "row_no");

-- CreateIndex
CREATE INDEX "bom_lines_product_id_idx" ON "bom_lines"("product_id");

-- CreateIndex
CREATE INDEX "bom_lines_material_id_idx" ON "bom_lines"("material_id");

-- CreateIndex
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_entity_at_idx" ON "audit_log"("entity", "at" DESC);

