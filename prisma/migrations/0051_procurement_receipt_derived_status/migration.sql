CREATE OR REPLACE FUNCTION guard_purchase_order_status_transition() RETURNS trigger AS $$
DECLARE
  line_count integer;
  open_lines integer;
  receipt_count integer;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status='DRAFT' AND NEW.status IN ('SUBMITTED','CANCELLED')) OR
    (OLD.status='SUBMITTED' AND NEW.status IN ('APPROVED','CANCELLED')) OR
    (OLD.status='APPROVED' AND NEW.status IN ('ORDERED','CANCELLED')) OR
    (OLD.status='ORDERED' AND NEW.status IN ('PARTIALLY_RECEIVED','RECEIVED','CANCELLED')) OR
    (OLD.status='PARTIALLY_RECEIVED' AND NEW.status='RECEIVED')
  ) THEN
    RAISE EXCEPTION 'Invalid purchase order status transition from % to %',OLD.status,NEW.status;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('PARTIALLY_RECEIVED','RECEIVED') THEN
    SELECT count(*)::int,
           count(*) FILTER (WHERE COALESCE(received.total,0) < l."quantityOrdered")::int
      INTO line_count,open_lines
      FROM "PurchaseOrderLine" l
      LEFT JOIN LATERAL (
        SELECT sum(r."quantityReceived") AS total
          FROM "PurchaseOrderReceipt" r
         WHERE r."organizationId"=l."organizationId"
           AND r."purchaseOrderLineId"=l.id
      ) received ON true
     WHERE l."organizationId"=NEW."organizationId"
       AND l."purchaseOrderId"=NEW.id;

    SELECT count(*)::int INTO receipt_count
      FROM "PurchaseOrderReceipt" r
      JOIN "PurchaseOrderLine" l
        ON l."organizationId"=r."organizationId"
       AND l.id=r."purchaseOrderLineId"
     WHERE l."organizationId"=NEW."organizationId"
       AND l."purchaseOrderId"=NEW.id;

    IF NEW.status='PARTIALLY_RECEIVED' AND (receipt_count=0 OR open_lines=0) THEN
      RAISE EXCEPTION 'PARTIALLY_RECEIVED requires at least one receipt and outstanding ordered quantity';
    END IF;
    IF NEW.status='RECEIVED' AND (line_count=0 OR open_lines<>0) THEN
      RAISE EXCEPTION 'RECEIVED requires all purchase order lines to be fully received';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
