import { LightningElement, track } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import LightningConfirm from "lightning/confirm";
import getSetupState from "@salesforce/apex/WhatsAppAdminController.getSetupState";
import getObjectOptions from "@salesforce/apex/WhatsAppAdminController.getObjectOptions";
import getFieldOptions from "@salesforce/apex/WhatsAppAdminController.getFieldOptions";
import getMappings from "@salesforce/apex/WhatsAppAdminController.getMappings";
import saveMapping from "@salesforce/apex/WhatsAppAdminController.saveMapping";
import deleteMapping from "@salesforce/apex/WhatsAppAdminController.deleteMapping";
import getRules from "@salesforce/apex/WhatsAppAdminController.getRules";
import saveRule from "@salesforce/apex/WhatsAppAdminController.saveRule";
import deleteRule from "@salesforce/apex/WhatsAppAdminController.deleteRule";
import getDiagnostics from "@salesforce/apex/WhatsAppAdminController.getDiagnostics";
import saveDefaults from "@salesforce/apex/WhatsAppAdminController.saveDefaults";

const EMPTY_MAPPING = {
  Id: null,
  Name: "",
  Object_API_Name__c: "",
  Phone_Field__c: "",
  Country_Code_Field__c: "",
  Name_Field__c: "",
  Priority__c: 1,
  Is_Active__c: true,
  Create_If_Missing__c: false,
  Create_Object__c: "",
  Duplicate_Behavior__c: "Use Existing"
};

const EMPTY_RULE = {
  Id: null,
  Name: "",
  Description__c: "",
  Object_API_Name__c: "",
  Priority__c: 10,
  Is_Active__c: true,
  Match_Type__c: "All",
  Conditions_JSON__c: "[]",
  Actions_JSON__c: "[]",
  Stop_On_Match__c: true,
  Version__c: "1"
};

export default class WhatsappSetup extends LightningElement {
  @track setup = {};
  @track defaultForm = {
    Default_Lead_Owner__c: "",
    Default_Case_Owner__c: "",
    Default_Case_Queue__c: "",
    Default_Queue_Id__c: "",
    Case_Record_Type_Id__c: "",
    Enable_Auto_Create_Lead__c: false,
    Auto_Create_Case__c: false
  };
  @track objectOptions = [];
  @track fieldOptions = [];
  @track mappings = [];
  @track rules = [];
  @track diagnostics = {};
  @track errorMessage;
  @track isLoading = true;
  @track isSaving = false;
  @track mappingForm = null;
  @track ruleForm = null;

  connectedCallback() {
    this.loadAll();
  }

  async loadAll() {
    this.isLoading = true;
    this.errorMessage = undefined;
    try {
      const [setup, objectOptions, mappings, rules] = await Promise.all([
        getSetupState(),
        getObjectOptions(),
        getMappings(),
        getRules()
      ]);
      this.setup = setup || {};
      this.defaultForm = {
        Default_Lead_Owner__c: setup?.defaultLeadOwner || "",
        Default_Case_Owner__c: setup?.defaultCaseOwner || "",
        Default_Case_Queue__c: setup?.defaultCaseQueue || "",
        Default_Queue_Id__c: setup?.defaultQueue || "",
        Case_Record_Type_Id__c: setup?.caseRecordType || "",
        Enable_Auto_Create_Lead__c: setup?.autoCreateLead === true,
        Auto_Create_Case__c: setup?.autoCreateCase === true
      };
      this.objectOptions = objectOptions || [];
      this.mappings = mappings || [];
      this.rules = rules || [];
      await this.loadDiagnostics();
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadDiagnostics() {
    try {
      this.diagnostics = (await getDiagnostics()) || {};
    } catch {
      this.diagnostics = {};
    }
  }

  get isConfigured() {
    return this.setup && this.setup.configured;
  }

  get statusLabel() {
    return this.isConfigured ? "Connected" : "Not configured";
  }

  get statusClass() {
    return this.isConfigured ? "status-pill connected" : "status-pill";
  }

  get webhookUrl() {
    return this.setup?.webhookUrl || "";
  }

  get accessTokenMasked() {
    return this.setup?.accessTokenMasked || "Not set";
  }

  get verifyTokenMasked() {
    return this.setup?.verifyTokenMasked || "Not set";
  }

  get graphVersion() {
    return this.setup?.graphVersion || "v27.0";
  }

  get mappingTitle() {
    return this.mappingForm?.Id ? "Edit object mapping" : "New object mapping";
  }

  get ruleTitle() {
    return this.ruleForm?.Id ? "Edit routing rule" : "New routing rule";
  }

  get mappingRows() {
    return this.mappings.map((mapping) => ({
      ...mapping,
      activeLabel: mapping.Is_Active__c ? "Active" : "Inactive"
    }));
  }

  get ruleRows() {
    return this.rules.map((rule) => ({
      ...rule,
      activeLabel: rule.Is_Active__c ? "Active" : "Inactive"
    }));
  }

  get hasMappings() {
    return this.mappings.length > 0;
  }

  get hasRules() {
    return this.rules.length > 0;
  }

  get diagnosticsWebhookEvents() {
    return this.diagnostics?.webhookEvents || [];
  }

  get diagnosticsApiLogs() {
    return this.diagnostics?.apiLogs || [];
  }

  get diagnosticsQueueDepth() {
    return this.diagnostics?.queueDepth ?? 0;
  }

  get diagnosticsFailedWebhooks() {
    return this.diagnostics?.failedWebhooks ?? 0;
  }

  get diagnosticsFailedMessages() {
    return this.diagnostics?.failedMessages ?? 0;
  }

  get duplicateBehaviorOptions() {
    return [
      { label: "Use existing", value: "Use Existing" },
      { label: "Flag for review", value: "Flag" },
      { label: "Create new", value: "Create" }
    ];
  }

  get matchTypeOptions() {
    return [
      { label: "Match all conditions", value: "All" },
      { label: "Match any condition", value: "Any" }
    ];
  }

  handleNewMapping() {
    this.mappingForm = { ...EMPTY_MAPPING };
    this.fieldOptions = [];
  }

  async handleEditMapping(event) {
    const id = event.currentTarget.dataset.id;
    const mapping = this.mappings.find((item) => item.Id === id);
    if (!mapping) {
      return;
    }
    this.mappingForm = {
      ...EMPTY_MAPPING,
      ...mapping,
      Priority__c: mapping.Priority__c ?? 1,
      Is_Active__c: mapping.Is_Active__c ?? true,
      Create_If_Missing__c: mapping.Create_If_Missing__c ?? false
    };
    await this.loadFieldOptions(mapping.Object_API_Name__c);
  }

  handleCancelMapping() {
    this.mappingForm = null;
    this.fieldOptions = [];
  }

  async handleMappingObjectChange(event) {
    const objectName = event.detail.value;
    this.mappingForm = {
      ...this.mappingForm,
      Object_API_Name__c: objectName,
      Phone_Field__c: "",
      Country_Code_Field__c: "",
      Name_Field__c: ""
    };
    await this.loadFieldOptions(objectName);
  }

  async loadFieldOptions(objectName) {
    if (!objectName) {
      this.fieldOptions = [];
      return;
    }
    try {
      this.fieldOptions = (await getFieldOptions({ objectName })) || [];
    } catch (error) {
      this.fieldOptions = [];
      this.showToast("Error", this.getErrorMessage(error), "error");
    }
  }

  handleMappingFieldChange(event) {
    const field = event.target.dataset.field;
    if (!field) {
      return;
    }
    let value = event.detail?.value ?? event.target.value;
    if (event.target.type === "checkbox") {
      value = event.target.checked;
    } else if (field === "Priority__c") {
      value = value === "" ? null : Number(value);
    }
    this.mappingForm = { ...this.mappingForm, [field]: value };
  }

  async handleSaveMapping() {
    if (!this.mappingForm || this.isSaving) {
      return;
    }
    this.isSaving = true;
    try {
      await saveMapping({ mapping: this.mappingForm });
      this.showToast("Success", "Object mapping saved.", "success");
      this.mappingForm = null;
      this.mappings = (await getMappings()) || [];
    } catch (error) {
      this.showToast("Error", this.getErrorMessage(error), "error");
    } finally {
      this.isSaving = false;
    }
  }

  async handleDeleteMapping(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    const confirmed = await LightningConfirm.open({
      label: "Delete mapping?",
      message:
        "This mapping will stop being used for inbound and outbound number resolution.",
      variant: "headerless"
    });
    if (!confirmed) {
      return;
    }
    try {
      await deleteMapping({ mappingId: id });
      this.showToast("Success", "Mapping deleted.", "success");
      this.mappings = (await getMappings()) || [];
    } catch (error) {
      this.showToast("Error", this.getErrorMessage(error), "error");
    }
  }

  handleNewRule() {
    this.ruleForm = { ...EMPTY_RULE };
  }

  handleEditRule(event) {
    const id = event.currentTarget.dataset.id;
    const rule = this.rules.find((item) => item.Id === id);
    if (!rule) {
      return;
    }
    this.ruleForm = {
      ...EMPTY_RULE,
      ...rule,
      Priority__c: rule.Priority__c ?? 10,
      Is_Active__c: rule.Is_Active__c ?? true,
      Stop_On_Match__c: rule.Stop_On_Match__c ?? true
    };
  }

  handleCancelRule() {
    this.ruleForm = null;
  }

  handleRuleFieldChange(event) {
    const field = event.target.dataset.field;
    if (!field) {
      return;
    }
    let value = event.detail?.value ?? event.target.value;
    if (event.target.type === "checkbox") {
      value = event.target.checked;
    } else if (field === "Priority__c") {
      value = value === "" ? null : Number(value);
    }
    this.ruleForm = { ...this.ruleForm, [field]: value };
  }

  async handleSaveRule() {
    if (!this.ruleForm || this.isSaving) {
      return;
    }
    this.isSaving = true;
    try {
      await saveRule({ rule: this.ruleForm });
      this.showToast("Success", "Routing rule saved.", "success");
      this.ruleForm = null;
      this.rules = (await getRules()) || [];
    } catch (error) {
      this.showToast("Error", this.getErrorMessage(error), "error");
    } finally {
      this.isSaving = false;
    }
  }

  async handleDeleteRule(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    const confirmed = await LightningConfirm.open({
      label: "Delete rule?",
      message: "This routing rule will no longer be evaluated.",
      variant: "headerless"
    });
    if (!confirmed) {
      return;
    }
    try {
      await deleteRule({ ruleId: id });
      this.showToast("Success", "Rule deleted.", "success");
      this.rules = (await getRules()) || [];
    } catch (error) {
      this.showToast("Error", this.getErrorMessage(error), "error");
    }
  }

  handleDefaultsFieldChange(event) {
    const field = event.target.dataset.field;
    if (!field) {
      return;
    }
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    this.defaultForm = { ...this.defaultForm, [field]: value };
  }

  async handleSaveDefaults() {
    if (this.isSaving) {
      return;
    }
    this.isSaving = true;
    try {
      await saveDefaults({
        defaultLeadOwner: this.defaultForm.Default_Lead_Owner__c,
        defaultCaseOwner: this.defaultForm.Default_Case_Owner__c,
        defaultCaseQueue: this.defaultForm.Default_Case_Queue__c,
        defaultQueue: this.defaultForm.Default_Queue_Id__c,
        caseRecordType: this.defaultForm.Case_Record_Type_Id__c,
        autoCreateLead: this.defaultForm.Enable_Auto_Create_Lead__c,
        autoCreateCase: this.defaultForm.Auto_Create_Case__c
      });
      this.showToast("Success", "Record defaults saved.", "success");
      this.setup = (await getSetupState()) || {};
    } catch (error) {
      this.showToast("Error", this.getErrorMessage(error), "error");
    } finally {
      this.isSaving = false;
    }
  }

  handleRefresh() {
    this.loadAll();
  }

  handleRefreshDiagnostics() {
    this.loadDiagnostics();
  }

  showToast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }

  getErrorMessage(error) {
    if (error?.body?.message) {
      return error.body.message;
    }
    if (error?.body?.pageErrors?.[0]?.message) {
      return error.body.pageErrors[0].message;
    }
    return error?.message || "Something went wrong.";
  }
}
