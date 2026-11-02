"""The supplied 26-process mapping. Company-specific SOP decisions remain configurable."""


def field(key, label, type="text", required=False, options=None):
    result = {"key": key, "label": label, "type": type, "required": required}
    if options:
        result["options"] = options
    return result


def steps(text):
    result = []
    for label in text.split(" | "):
        kind = "task"
        if label.startswith("@"):
            kind, label = label[1:].split(":", 1)
        result.append({"label": label, "kind": kind})
    return result


def process(number, title, group, prefix, workflow, fields=(), **extra):
    return {"number": number, "title": title, "group": group, "prefix": prefix,
            "steps": steps(workflow), "fields": list(fields), "sop_status": "to_confirm", **extra}


ITEMS = field("items", "Items, quantities and unit prices", "items", True)
SUPPLIER = field("supplier_id", "Supplier", "supplier")
AMOUNT = field("amount", "Amount (RM)", "money", True)
PURPOSE = field("purpose", "Purpose / requirement", "textarea", True)
QUOTATION = [SUPPLIER, ITEMS, field("valid_until", "Quotation valid until", "date"), field("terms", "Terms and specification", "textarea")]
PAYMENT = [AMOUNT, field("payee", "Supplier / payee", required=True), field("invoice_number", "Invoice / bill number"), field("billing_period", "Billing period"), PURPOSE]
RENEWAL = [field("registration_number", "Licence / registration number", required=True), field("authority", "Issuing authority"), field("renewal_channel", "Renewal portal / channel"), field("document_checklist", "Required supporting documents", "textarea"), field("new_expiry_date", "New expiry date", "date")]
MAINTENANCE = [field("asset", "Equipment / area", required=True), PURPOSE, field("service_type", "Service type", "select", True, ["Inspection", "General service", "Chemical cleaning", "Repair", "Other"]), field("service_route", "Service route", "select", True, ["Internal", "External contractor"]), field("contractor_id", "Contractor", "supplier"), field("service_date", "Service date", "date"), field("next_service_date", "Next service date", "date"), field("completion_notes", "Work completion / inspection", "textarea")]

CATALOG = {
    "stationery_purchase": process(1, "Stationery Purchasing", "purchasing", "ST",
        "Identify stationery requirement | Submit purchase requisition | Check previous quotation | Obtain quotation if required | @approval:Obtain purchase approval | Prepare purchase order | Place order with supplier | Receive stationery | @verify:Verify delivery and supporting documents | File documents", [PURPOSE, SUPPLIER, ITEMS]),
    "equipment_purchase": process(2, "Office Equipment Purchasing", "purchasing", "EQ",
        "Identify equipment requirement | Submit purchase request | Check existing equipment | Obtain supplier quotation | Review quotation and specifications | @approval:Obtain equipment approval | Issue purchase order | Receive equipment | @verify:Verify equipment | Update equipment register | Archive documents", [PURPOSE, SUPPLIER, ITEMS, field("existing_equipment_check", "Existing equipment check", "textarea")]),
    "purchase_requisition": process(3, "Purchase Requisition (PR)", "purchasing", "PR",
        "Identify requirement | Complete requisition form | Submit to HR Admin | Review request details | @verify:Check supporting quotation | @approval:Obtain PR approval | Proceed to purchase order | Update PR status", [PURPOSE, ITEMS, SUPPLIER]),
    "purchase_order": process(4, "Purchase Order (PO)", "purchasing", "PO",
        "Receive approved purchase request | Check supplier information | Confirm quotation | Generate purchase order PDF | Send PO to supplier | Supplier processes order | Receive goods | @verify:Verify delivery against PO | Record completion | Archive PO and documents", [SUPPLIER, ITEMS, field("delivery_address", "Delivery address", "textarea"), field("delivery_date", "Expected delivery", "date"), field("delivery_notes", "Delivery verification / discrepancies", "textarea")]),
    "quotation": process(5, "Quotation Management", "purchasing", "QT",
        "Identify required item or service | Check previous quotation | Request new quotation | Receive quotation | Review price and specifications | Compare quotations | @approval:Approve selected quotation | Attach to PR or PO | Archive quotation", QUOTATION),
    "uniform_management": process(6, "Uniform Management", "inventory", "UN",
        "Identify uniform requirement | Confirm uniform type | Confirm material and design | Obtain supplier quotation | @approval:Approve uniform design and order | Raise purchase order | Receive uniform stock | @verify:Check sizes and quantities | Store uniforms | Record uniform distribution | Update stock balance", [field("uniform_type", "Uniform type", "select", True, ["ESG uniform", "Existing uniform", "New design"]), field("material", "Material"), field("design", "Design"), SUPPLIER, ITEMS]),
    "uniform_replenishment": process(7, "Uniform Stock Replenishment", "inventory", "UR",
        "Check existing stock | Identify low stock | Confirm reorder quantity and sizes | Check supplier and previous price | Request quotation if required | @approval:Approve reorder | Issue purchase order | Receive replenished stock | @verify:Verify quantity and sizes | Update inventory | Close replenishment record", [PURPOSE, SUPPLIER, ITEMS, field("inventory_item_id", "Inventory item ID", "integer")]),
    "filing": process(8, "Filing & Documentation", "documents", "DOC",
        "Receive documents | @verify:Check document completeness | Obtain required signatures | Organise by company and type | File documents | Confirm retrieval and access | Review retention period", [field("document_type", "Document category", required=True), field("folder", "Folder / department"), field("retention_review_date", "Retention review date", "date"), field("retention_notes", "Confirmed retention policy / reference", "textarea")]),
    "eform": process(9, "E-Form & Electronic Approval", "documents", "EF",
        "Select e-form | Fill in online form | Attach supporting documents | Submit form | Assign request number | Route to responsible person | @approval:Review and approve form | Notify requestor | Archive approved form | Download or print", [field("form_type", "Form type", required=True), PURPOSE, field("form_content", "Form contents", "textarea", True)]),
    "payment_advice": process(10, "Payment Advice", "finance", "PA",
        "Receive invoice or bill | Review payment details | Prepare payment advice | @verify:Verify supporting documents | @approval:Approve payment advice | Obtain approved payment advice | Submit to Finance | @finance:Finance processes payment | Confirm payment status | File payment records", PAYMENT),
    "utility_bill": process(11, "Utility Bill Management", "utilities", "UB",
        "Access utility provider portal | Download monthly bill | Check account, period, amount and due date | Prepare payment advice | @verify:Attach and verify invoice | @approval:Approve payment advice | Forward to Finance | @finance:Finance processes payment | Track payment status | Archive bill", [field("payment_route", "Bill route", "select", True, ["HR Admin handling", "Direct to Finance", "Payment on behalf / reimbursement"]), field("utility_type", "Utility", "select", True, ["Electricity", "Water", "Internet", "Telephone", "Other"]), field("account_number", "Utility account", required=True), *PAYMENT], routes={
            "Direct to Finance": steps("Utility provider issues bill | Finance receives bill | @verify:Finance verifies bill | @approval:Obtain applicable Finance approval | @finance:Finance processes payment | Update payment record | Share copy and status with HR Admin"),
            "Payment on behalf / reimbursement": steps("Identify urgent payment | Record person paying on behalf | Keep payment evidence | Prepare reimbursement request | @verify:Verify supporting documents | @approval:Approve reimbursement | @finance:Finance reimburses payee | Close payment record"),
        }),
    "vehicle_insurance": process(12, "Vehicle Insurance Renewal", "insurance", "INS",
        "Check insurance expiry | Identify vehicles due | Contact insurance provider | Request renewal quotation | Receive quotation | Review vehicle and coverage | @approval:Approve renewal | Submit payment request | @finance:Finance processes payment | Receive renewed policy | @verify:Verify policy dates and details | Update insurance register | Keep renewal documents", [field("vehicle_plate", "Vehicle registration", required=True), field("provider", "Insurance provider", required=True), field("policy_number", "Policy number"), field("coverage", "Coverage", "textarea"), field("amount", "Premium (RM)", "money"), field("new_expiry_date", "New policy expiry", "date")], renewable=True),
    "road_tax": process(13, "Road Tax Renewal", "insurance", "RT",
        "Check road tax expiry | Identify vehicle for renewal | Verify insurance status | Select renewal channel | Prepare vehicle details | @approval:Approve renewal and payment arrangement | Complete road tax renewal | @verify:Verify new expiry date | Update vehicle register | Archive renewal proof", [field("vehicle_plate", "Vehicle registration", required=True), field("insurance_valid_until", "Insurance valid until", "date", True), field("renewal_channel", "Renewal channel", "select", True, ["MyEG", "JPJ", "Other"]), field("amount", "Renewal fee (RM)", "money"), field("new_expiry_date", "New road tax expiry", "date")], renewable=True),
    "business_licence": process(14, "Business Licence Renewal", "licences", "LIC",
        "Maintain company register | Record business licence | Check expiry date | Identify expiring licence | Prepare renewal documents | Complete renewal application | @approval:Approve renewal and fees | Submit renewal | Receive renewal result | @verify:Verify renewed licence | Update expiry date | Archive documents", RENEWAL, renewable=True),
    "registration": process(15, "MOF & CIDB Renewal", "licences", "REG",
        "Record registration information | Check registration expiry | Prepare supporting documents | Review renewal requirements | @approval:Obtain internal approval | Submit renewal application | Arrange required payment | Check application status | Receive updated registration | Update register and archive", [field("registration_type", "Registration type", "select", True, ["MOF", "CIDB"]), *RENEWAL], renewable=True),
    "memo": process(16, "Memo Preparation & Approval", "memos", "MEM",
        "Receive memo request | Prepare memo draft | Check content and recipients | Submit for review | @approval:Approve memo | Revise or confirm final content | Finalise memo | @distribute:Distribute memo to recipients | @acknowledge:Collect acknowledgements | Follow up outstanding recipients | Archive memo", [field("content", "Memo content", "textarea", True), field("recipient_ids", "Recipients", "users", True), field("acknowledgement_required", "Require acknowledgement", "checkbox")]),
    "facility_maintenance": process(17, "Office & Facility Maintenance", "maintenance", "MT",
        "Identify maintenance requirement | Inspect equipment or facility | Assess internal repair | Contact contractor if required | Request quotation | Receive quotation | @approval:Approve maintenance | Arrange service date | Carry out maintenance | @verify:Verify work completion | Forward payment documents to Finance | Update maintenance record", MAINTENANCE),
    "aircon_maintenance": process(18, "Air Conditioning Maintenance", "maintenance", "AC",
        "Check service schedule | Inspect air conditioning | Determine service type | Confirm internal or external service | Contact contractor if required | Obtain quotation if required | @approval:Approve service if required | Arrange service | Perform maintenance | @verify:Verify service completion | Record maintenance and next service", MAINTENANCE, renewable=True),
    "housekeeping": process(19, "Housekeeping Management", "maintenance", "HK",
        "Daily office cleaning | Department maintains own area | Perform general inspection | Identify housekeeping issue | Report to responsible person | Arrange corrective action | Recheck area | Close issue", [field("area", "Office / area", required=True), field("department", "Responsible department", required=True), field("inspection_checklist", "Inspection checklist", "textarea"), PURPOSE, field("corrective_action", "Corrective action", "textarea")], optional=True),
    "security_parking": process(20, "Security & Parking Administration", "maintenance", "SEC",
        "Receive request or issue | Identify request type | Verify request details | @approval:Obtain applicable approval | Coordinate with responsible party | Resolve issue or complete request | Update administration register | Close request", [field("request_type", "Request type", "select", True, ["Parking", "Access card", "Security issue", "Other"]), field("employee", "Employee / contact", required=True), field("parking_space", "Parking space / vehicle"), field("access_card_number", "Access card number"), PURPOSE]),
    "petty_cash": process(21, "Petty Cash Management", "claims", "PC",
        "Confirm authorised float and custodian | Record eligible expense | Collect receipts | Prepare petty cash form | Attach supporting documents | Submit for verification | @verify:Verify receipts and company details | @approval:Obtain applicable manager and director approvals | Submit to Finance | @finance:Finance processes replenishment | Update cash ledger balance | File documents", [AMOUNT, PURPOSE, field("cash_account_id", "Petty cash account ID", "integer"), field("receipt_number", "Receipt number")]),
    "reimbursement": process(22, "Reimbursement Claims", "claims", "CLM",
        "Record eligible payment | Keep receipt | Prepare reimbursement form | Enter amount and purpose | Attach supporting documents | Submit claim | @verify:Verify claim documents | @approval:Obtain applicable approvals | Forward to Finance | @finance:Finance processes reimbursement | Record reimbursement status | Archive claim", [AMOUNT, PURPOSE, field("payee", "Employee / payee", required=True), field("expense_date", "Expense date", "date", True), field("receipt_number", "Receipt number")]),
    "document_verification": process(23, "Supporting Document Verification", "documents", "VER",
        "Receive submitted documents | Identify document type | Check required documents | Verify company, amount and date | Check missing or duplicate records | Request corrections if required | @verify:Record verification result | Forward for approval | Archive verified documents", [field("document_type", "Document type", required=True), field("verification_checklist", "Verification checklist", "textarea", True), field("verification_comments", "Verification comments", "textarea")]),
    "finance_handoff": process(25, "Finance Handoff & Payment Tracking", "finance", "FIN",
        "Prepare payment documents | @verify:Check required attachments | @approval:Obtain internal approval | Submit to Finance | Finance receives request | Finance verifies request | @finance:Finance processes payment | Record payment reference | Communicate payment status | Close payment request | Archive evidence", PAYMENT),
    "supplier": process(None, "Supplier & Contractor Register", "purchasing", "SUP",
        "Check supplier details | Confirm supplier registration", [field("contact_name", "Contact person", required=True), field("email", "Email", "email"), field("phone", "Telephone"), field("address", "Address", "textarea"), field("services", "Items / services", "textarea")]),
}

GROUPS = {
    "purchasing": "Purchasing & Suppliers", "inventory": "Uniforms & Inventory",
    "documents": "Documents & E-Forms", "finance": "Payments & Finance",
    "utilities": "Utility Bills", "insurance": "Insurance & Road Tax",
    "licences": "Licences, MOF & CIDB", "memos": "Memos",
    "maintenance": "Office & Facility Services", "claims": "Petty Cash & Claims",
}


def record_steps(record):
    definition = CATALOG[record.kind]
    return definition.get("routes", {}).get(record.data.get("payment_route"), definition["steps"])
