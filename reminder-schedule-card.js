/**
 * Reminder Schedule Card
 * A Home Assistant Lovelace custom card for managing daily reminder
 * schedules (medicine, alms-giving, meals, etc.) built on top of
 * `input_boolean` (enabled), `input_datetime` (time) and `input_text`
 * (message) helpers, plus an optional `input_select` row for picking
 * which notification target device to use.
 *
 * Each reminder is one configurable "item" with an icon + title, an
 * enable/disable toggle, a time field, and one or two free-text
 * message fields (the second one is optional — handy for things like
 * a special "wan phra" message that only applies on certain days).
 * Items can be added or removed entirely from the visual editor —
 * no YAML editing required for day-to-day use.
 */

const CARD_VERSION = "1.0.0";

console.info(
  `%c REMINDER-SCHEDULE-CARD %c v${CARD_VERSION} `,
  "color: #1b1b1b; background: #fbbf24; font-weight: 700; border-radius: 3px 0 0 3px; padding: 2px 0 2px 6px;",
  "color: #fbbf24; background: #2a2a2a; font-weight: 700; border-radius: 0 3px 3px 0; padding: 2px 6px 2px 0;"
);

const blankItem = () => ({
  icon: "🔔",
  title: "แจ้งเตือนใหม่",
  enabled_entity: "",
  time_entity: "",
  message_entity: "",
  message_2_label: "",
  message_2_entity: "",
});

class ReminderScheduleCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    if (!config) {
      throw new Error("กรุณากำหนด config ของการ์ด");
    }
    this._config = {
      title: config.title || "ตารางแจ้งเตือนประจำวัน",
      device_entity: config.device_entity || "",
      device_label: config.device_label || "อุปกรณ์แจ้งเตือน",
      device_icon: config.device_icon || "🔊",
      items: Array.isArray(config.items) ? config.items : [],
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    const itemRows = this._config?.items?.reduce((sum, item) => {
      let rows = 1; // header
      if (item.enabled_entity) rows += 1;
      if (item.time_entity) rows += 1;
      if (item.message_entity) rows += 1;
      if (item.message_2_entity) rows += 1;
      return sum + rows;
    }, 0) || 0;
    return 1 + Math.ceil(itemRows / 2) + (this._config?.device_entity ? 1 : 0);
  }

  static getConfigElement() {
    return document.createElement("reminder-schedule-card-editor");
  }

  static getStubConfig() {
    return {
      title: "ตารางแจ้งเตือนประจำวัน",
      items: [
        {
          icon: "💊",
          title: "กินยา",
          enabled_entity: "",
          time_entity: "",
          message_entity: "",
        },
      ],
    };
  }

  _getState(entityId) {
    if (!entityId || !this._hass) return undefined;
    const st = this._hass.states[entityId];
    return st ? st.state : undefined;
  }

  _entityExists(entityId) {
    return !!entityId && !!this._hass && !!this._hass.states[entityId];
  }

  _callService(domain, service, entityId, data) {
    if (!this._hass || !entityId) return;
    this._hass.callService(domain, service, { entity_id: entityId, ...(data || {}) });
  }

  _toggleBoolean(entityId) {
    const current = this._getState(entityId);
    this._callService("input_boolean", current === "on" ? "turn_off" : "turn_on", entityId);
  }

  _setTime(entityId, hhmm) {
    if (!hhmm) return;
    this._callService("input_datetime", "set_datetime", entityId, { time: `${hhmm}:00` });
  }

  _setText(entityId, value) {
    this._callService("input_text", "set_value", entityId, { value });
  }

  _selectOption(entityId, value) {
    this._callService("input_select", "select_option", entityId, { option: value });
  }

  _fmtTime(rawState) {
    // input_datetime แบบ time-only จะส่ง state มาเป็น "HH:MM:SS"
    if (!rawState || typeof rawState !== "string") return "";
    return rawState.slice(0, 5);
  }

  _escape(str) {
    if (str === undefined || str === null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  _unavailableRow(label) {
    return `
      <div class="row">
        <span class="row-label">${this._escape(label)}</span>
        <span class="unavailable">ไม่พบ entity</span>
      </div>`;
  }

  _renderItem(item, idx) {
    const rows = [];

    if (item.enabled_entity) {
      if (!this._entityExists(item.enabled_entity)) {
        rows.push(this._unavailableRow("เปิดใช้งานการแจ้งเตือน"));
      } else {
        const isOn = this._getState(item.enabled_entity) === "on";
        rows.push(`
          <div class="row">
            <span class="row-label">เปิดใช้งานการแจ้งเตือน</span>
            <button class="toggle ${isOn ? "on" : "off"}" data-action="toggle" data-idx="${idx}" aria-label="toggle"></button>
          </div>`);
      }
    }

    if (item.time_entity) {
      if (!this._entityExists(item.time_entity)) {
        rows.push(this._unavailableRow("เวลาแจ้งเตือน"));
      } else {
        const timeVal = this._fmtTime(this._getState(item.time_entity));
        rows.push(`
          <div class="row">
            <span class="row-label">เวลาแจ้งเตือน</span>
            <input type="time" class="time-input" data-action="time" data-idx="${idx}" value="${timeVal}" />
          </div>`);
      }
    }

    if (item.message_entity) {
      if (!this._entityExists(item.message_entity)) {
        rows.push(this._unavailableRow("ข้อความแจ้งเตือน"));
      } else {
        const msgVal = this._escape(this._getState(item.message_entity) ?? "");
        rows.push(`
          <div class="row">
            <span class="row-label">ข้อความแจ้งเตือน</span>
            <input type="text" class="msg-input" data-action="msg" data-idx="${idx}" value="${msgVal}" />
          </div>`);
      }
    }

    if (item.message_2_entity) {
      const label = item.message_2_label || "ข้อความเพิ่มเติม";
      if (!this._entityExists(item.message_2_entity)) {
        rows.push(this._unavailableRow(label));
      } else {
        const msg2Val = this._escape(this._getState(item.message_2_entity) ?? "");
        rows.push(`
          <div class="row">
            <span class="row-label">${this._escape(label)}</span>
            <input type="text" class="msg-input" data-action="msg2" data-idx="${idx}" value="${msg2Val}" />
          </div>`);
      }
    }

    return `
      <div class="item">
        <div class="item-header">
          <span class="item-icon">${this._escape(item.icon || "🔔")}</span>
          <span class="item-title">${this._escape(item.title || "")}</span>
        </div>
        ${rows.join("")}
      </div>`;
  }

  _renderDeviceItem() {
    const entityId = this._config.device_entity;
    if (!entityId) return "";

    let controlHtml;
    if (!this._entityExists(entityId)) {
      return `
        <div class="item">
          <div class="item-header">
            <span class="item-icon">${this._escape(this._config.device_icon)}</span>
            <span class="item-title">${this._escape(this._config.device_label)}</span>
          </div>
          ${this._unavailableRow("อุปกรณ์ที่ใช้แจ้งเตือน")}
        </div>`;
    }

    const st = this._hass.states[entityId];
    const options = Array.isArray(st.attributes.options) ? st.attributes.options : [];
    const current = st.state;
    controlHtml = `
      <select class="device-select" data-action="device">
        ${options
          .map(
            (opt) =>
              `<option value="${this._escape(opt)}" ${opt === current ? "selected" : ""}>${this._escape(opt)}</option>`
          )
          .join("")}
      </select>`;

    return `
      <div class="item">
        <div class="item-header">
          <span class="item-icon">${this._escape(this._config.device_icon)}</span>
          <span class="item-title">${this._escape(this._config.device_label)}</span>
        </div>
        <div class="row">
          <span class="row-label">อุปกรณ์ที่ใช้แจ้งเตือน</span>
          ${controlHtml}
        </div>
      </div>`;
  }

  _render() {
    if (!this._config) return;

    const items = this._config.items || [];
    const itemsHtml = items.map((item, idx) => this._renderItem(item, idx)).join("");
    const deviceHtml = this._renderDeviceItem();

    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 16px; }
        .card-title {
          font-size: 1.2em;
          font-weight: 500;
          margin-bottom: 8px;
          color: var(--primary-text-color);
        }
        .item { padding: 8px 0; }
        .item:not(:last-child) { border-bottom: 1px solid var(--divider-color, #444); }
        .item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1em;
          font-weight: 500;
          padding: 4px 0 8px 0;
          color: var(--primary-text-color);
        }
        .item-icon { font-size: 1.15em; line-height: 1; }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          gap: 10px;
        }
        .row-label {
          color: var(--primary-text-color);
          font-size: 0.92em;
          flex-shrink: 0;
        }
        .time-input,
        .msg-input,
        .device-select {
          background: var(--secondary-background-color, #2c2c2c);
          color: var(--primary-text-color);
          border: 1px solid var(--divider-color, #444);
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 0.88em;
          font-family: inherit;
        }
        .msg-input { flex: 1 1 auto; min-width: 0; max-width: 220px; }
        .device-select { max-width: 220px; flex: 1 1 auto; }
        .unavailable {
          color: var(--error-color, #ef5350);
          font-size: 0.85em;
        }
        .toggle {
          width: 36px;
          height: 20px;
          border-radius: 999px;
          border: none;
          cursor: pointer;
          position: relative;
          padding: 0;
          flex-shrink: 0;
          background: var(--disabled-text-color, #5c5c5c);
          transition: background 0.15s ease;
        }
        .toggle.on { background: var(--primary-color, #03a9f4); }
        .toggle::after {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          transition: left 0.15s ease;
        }
        .toggle.on::after { left: 18px; }
      </style>
      <ha-card>
        <div class="card-title">${this._escape(this._config.title)}</div>
        ${itemsHtml}
        ${deviceHtml}
      </ha-card>
    `;

    this._attachHandlers();
  }

  _attachHandlers() {
    const items = this._config.items || [];
    const root = this.shadowRoot;

    root.querySelectorAll('[data-action="toggle"]').forEach((el) => {
      el.addEventListener("click", () => {
        const item = items[parseInt(el.dataset.idx, 10)];
        if (item) this._toggleBoolean(item.enabled_entity);
      });
    });

    root.querySelectorAll('[data-action="time"]').forEach((el) => {
      el.addEventListener("change", () => {
        const item = items[parseInt(el.dataset.idx, 10)];
        if (item) this._setTime(item.time_entity, el.value);
      });
    });

    root.querySelectorAll('[data-action="msg"]').forEach((el) => {
      el.addEventListener("change", () => {
        const item = items[parseInt(el.dataset.idx, 10)];
        if (item) this._setText(item.message_entity, el.value);
      });
    });

    root.querySelectorAll('[data-action="msg2"]').forEach((el) => {
      el.addEventListener("change", () => {
        const item = items[parseInt(el.dataset.idx, 10)];
        if (item) this._setText(item.message_2_entity, el.value);
      });
    });

    const deviceSelect = root.querySelector('[data-action="device"]');
    if (deviceSelect) {
      deviceSelect.addEventListener("change", () => {
        this._selectOption(this._config.device_entity, deviceSelect.value);
      });
    }
  }
}

class ReminderScheduleCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: config.title || "ตารางแจ้งเตือนประจำวัน",
      device_entity: config.device_entity || "",
      device_label: config.device_label || "อุปกรณ์แจ้งเตือน",
      device_icon: config.device_icon || "🔊",
      items: Array.isArray(config.items) ? config.items : [],
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _addItem() {
    const newItems = [...(this._config.items || []), blankItem()];
    this._updateConfig("items", newItems);
  }

  _removeItem(idx) {
    const newItems = (this._config.items || []).filter((_, i) => i !== idx);
    this._updateConfig("items", newItems);
  }

  _updateItemField(idx, field, value) {
    const newItems = (this._config.items || []).map((it, i) =>
      i === idx ? { ...it, [field]: value } : it
    );
    this._updateConfig("items", newItems);
  }

  _render() {
    if (!this._config) return;

    const inputStyle = `
      width: 100%;
      box-sizing: border-box;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #000);
      font-size: 13px;
      font-family: inherit;
    `;
    const labelStyle = `
      font-size: 12px;
      color: var(--secondary-text-color);
      display: block;
      margin-bottom: 4px;
    `;
    const iconInputStyle = `${inputStyle} width: 64px; text-align: center;`;

    const itemBlocks = (this._config.items || [])
      .map((item, idx) => {
        return `
        <div class="item-block" style="
          background: var(--secondary-background-color, #f0f0f0);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="font-size: 13px; color: var(--primary-text-color);">รายการที่ ${idx + 1}</strong>
            <button data-remove-idx="${idx}" style="
              background: none;
              border: 1px solid var(--error-color, #ef5350);
              color: var(--error-color, #ef5350);
              border-radius: 4px;
              padding: 4px 10px;
              cursor: pointer;
              font-size: 12px;
            ">🗑 ลบรายการนี้</button>
          </div>

          <div style="display: flex; gap: 8px;">
            <div style="width: 64px;">
              <label style="${labelStyle}">ไอคอน</label>
              <input type="text" data-item-idx="${idx}" data-field="icon" value="${item.icon || ""}" style="${iconInputStyle}" />
            </div>
            <div style="flex: 1;">
              <label style="${labelStyle}">ชื่อรายการ</label>
              <input type="text" data-item-idx="${idx}" data-field="title" value="${item.title || ""}" style="${inputStyle}" />
            </div>
          </div>

          <div>
            <label style="${labelStyle}">Entity เปิด/ปิดการแจ้งเตือน (input_boolean)</label>
            <ha-entity-picker
              data-item-idx="${idx}"
              data-field="enabled_entity"
              data-domain="input_boolean"
            ></ha-entity-picker>
          </div>

          <div>
            <label style="${labelStyle}">Entity เวลาแจ้งเตือน (input_datetime)</label>
            <ha-entity-picker
              data-item-idx="${idx}"
              data-field="time_entity"
              data-domain="input_datetime"
            ></ha-entity-picker>
          </div>

          <div>
            <label style="${labelStyle}">Entity ข้อความแจ้งเตือน (input_text)</label>
            <ha-entity-picker
              data-item-idx="${idx}"
              data-field="message_entity"
              data-domain="input_text"
            ></ha-entity-picker>
          </div>

          <div style="border-top: 1px dashed var(--divider-color, #ccc); padding-top: 8px;">
            <label style="${labelStyle}">ป้ายข้อความที่ 2 (ไม่บังคับ — เช่น "ข้อความวันพระ")</label>
            <input type="text" data-item-idx="${idx}" data-field="message_2_label" value="${item.message_2_label || ""}" style="${inputStyle}" />
          </div>
          <div>
            <label style="${labelStyle}">Entity ข้อความที่ 2 (ไม่บังคับ, input_text)</label>
            <ha-entity-picker
              data-item-idx="${idx}"
              data-field="message_2_entity"
              data-domain="input_text"
            ></ha-entity-picker>
          </div>
        </div>`;
      })
      .join("");

    this.innerHTML = `
      <div style="padding: 12px; display: flex; flex-direction: column; gap: 14px;">
        <div>
          <label style="${labelStyle}">ชื่อการ์ด</label>
          <input id="title" type="text" value="${this._config.title || ""}" style="${inputStyle}" />
        </div>

        <div style="
          background: var(--secondary-background-color, #f0f0f0);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <strong style="font-size: 13px; color: var(--primary-text-color);">อุปกรณ์แจ้งเตือน (ไม่บังคับ)</strong>
          <div style="display: flex; gap: 8px;">
            <div style="width: 64px;">
              <label style="${labelStyle}">ไอคอน</label>
              <input id="device_icon" type="text" value="${this._config.device_icon || ""}" style="${iconInputStyle}" />
            </div>
            <div style="flex: 1;">
              <label style="${labelStyle}">ชื่อหัวข้อ</label>
              <input id="device_label" type="text" value="${this._config.device_label || ""}" style="${inputStyle}" />
            </div>
          </div>
          <div>
            <label style="${labelStyle}">Entity เลือกอุปกรณ์ (input_select)</label>
            <ha-entity-picker
              id="device_entity_picker"
              data-domain="input_select"
            ></ha-entity-picker>
          </div>
        </div>

        <div style="font-size: 13px; color: var(--secondary-text-color);">
          รายการแจ้งเตือน (เพิ่ม/ลบได้อิสระ)
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${itemBlocks}
        </div>

        <button id="add-item-btn" style="
          background: var(--primary-color, #03a9f4);
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 10px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">+ เพิ่มรายการแจ้งเตือน</button>
      </div>
    `;

    this._attachListeners();
  }

  _attachListeners() {
    this.querySelector("#title")?.addEventListener("input", (ev) => {
      this._updateConfig("title", ev.target.value);
    });
    this.querySelector("#device_label")?.addEventListener("input", (ev) => {
      this._updateConfig("device_label", ev.target.value);
    });
    this.querySelector("#device_icon")?.addEventListener("input", (ev) => {
      this._updateConfig("device_icon", ev.target.value);
    });

    const devicePicker = this.querySelector("#device_entity_picker");
    if (devicePicker) {
      devicePicker.hass = this._hass;
      devicePicker.includeDomains = ["input_select"];
      devicePicker.value = this._config.device_entity || "";
      devicePicker.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        this._updateConfig("device_entity", ev.detail.value);
      });
    }

    this.querySelectorAll("ha-entity-picker[data-item-idx]").forEach((picker) => {
      picker.hass = this._hass;
      const idx = parseInt(picker.dataset.itemIdx, 10);
      const field = picker.dataset.field;
      const domain = picker.dataset.domain;
      if (domain) picker.includeDomains = [domain];
      picker.value = (this._config.items?.[idx] || {})[field] || "";
      picker.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        this._updateItemField(idx, field, ev.detail.value);
      });
    });

    this.querySelectorAll("input[data-item-idx]").forEach((input) => {
      input.addEventListener("input", (ev) => {
        const idx = parseInt(input.dataset.itemIdx, 10);
        const field = input.dataset.field;
        this._updateItemField(idx, field, ev.target.value);
      });
    });

    this.querySelectorAll("[data-remove-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._removeItem(parseInt(btn.dataset.removeIdx, 10));
      });
    });

    this.querySelector("#add-item-btn")?.addEventListener("click", () => {
      this._addItem();
    });
  }

  _updateConfig(path, value) {
    const newConfig = JSON.parse(JSON.stringify(this._config));
    const keys = path.split(".");
    let obj = newConfig;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    this._config = newConfig;

    const event = new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);

    // เรียก _render() เองทันที ไม่รอ round-trip กลับจาก parent (setConfig)
    // เพราะถ้ารอ parent ส่ง config กลับมา UI ที่ต้อง rebuild ทันที (เช่น
    // ลบ/เพิ่มรายการ) จะดูค้าง 1 จังหวะ
    this._render();
  }
}

customElements.define("reminder-schedule-card", ReminderScheduleCard);
customElements.define("reminder-schedule-card-editor", ReminderScheduleCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "reminder-schedule-card",
  name: "Reminder Schedule Card",
  description:
    "จัดตารางแจ้งเตือนประจำวัน (กินยา ใส่บาตร มื้ออาหาร ฯลฯ) ผ่าน input_boolean/input_datetime/input_text helper พร้อมเลือกอุปกรณ์แจ้งเตือนผ่าน input_select เพิ่ม/ลบรายการได้จากหน้าตั้งค่าการ์ดโดยตรง ไม่ต้องแก้ YAML",
  preview: true,
  documentationURL: "https://github.com/jingjoks/reminder-schedule-card",
});
