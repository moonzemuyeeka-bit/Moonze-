-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product" USING GIN ("brand" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "SupplierProfile_businessName_idx" ON "SupplierProfile" USING GIN ("businessName" gin_trgm_ops);
