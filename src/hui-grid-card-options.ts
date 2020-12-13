/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mdiDelete, mdiPencil } from '@mdi/js';
import { computeCardSize, fireEvent, HomeAssistant, LovelaceCard } from 'custom-card-helpers';
import { css, CSSResult, customElement, LitElement, property, queryAssignedNodes } from 'lit-element';
import { html, TemplateResult } from 'lit-html';

@customElement('hui-grid-card-options')
export class HuiGridCardOptions extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public lovelace?;

  @property({ type: Array }) public path?: [number, number];

  @queryAssignedNodes() private _assignedNodes?: NodeListOf<LovelaceCard>;

  public getCardSize(): number | Promise<number> {
    return this._assignedNodes ? computeCardSize(this._assignedNodes[0]) : 1;
  }

  protected render(): TemplateResult {
    return html`
      <slot></slot>
      <div class="parent-card-actions">
        <div class="overlay"></div>
        <div class="card-actions">
          <mwc-icon-button
            .title=${this.hass!.localize('ui.panel.lovelace.editor.edit_card.edit')}
            @click=${this._editCard}
          >
            <ha-svg-icon .path=${mdiPencil}></ha-svg-icon>
          </mwc-icon-button>
          <mwc-icon-button
            .title=${this.hass!.localize('ui.panel.lovelace.editor.edit_card.delete')}
            @click=${this._deleteCard}
          >
            <ha-svg-icon .path=${mdiDelete}></ha-svg-icon>
          </mwc-icon-button>
        </div>
      </div>
    `;
  }

  private _editCard(): void {
    fireEvent(this, 'll-edit-card' as any, { path: this.path });
  }

  private _deleteCard(): void {
    fireEvent(this, 'll-delete-card' as any, { path: this.path });
  }

  static get styles(): CSSResult {
    return css`
      slot {
        pointer-events: none;
        z-index: 0;
      }

      .overlay {
        transition: all 0.25s;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1;
        opacity: 0;
        cursor: move;
      }

      .parent-card-actions:hover .overlay {
        outline: 2px solid var(--primary-color);
        background: rgba(0, 0, 0, 0.3);
        /* background-color: grey; */
        opacity: 1;
      }

      .parent-card-actions {
        transition: all 0.25s;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        opacity: 0;
      }

      .parent-card-actions:hover {
        opacity: 1;
      }

      .card-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        z-index: 2;
        position: absolute;
        left: 0;
        right: 0;
        bottom: 24px;
        color: white;
      }

      .card-actions > * {
        margin: 0 4px;
        border-radius: 24px;
        background: rgba(0, 0, 0, 0.7);
      }

      mwc-list-item {
        cursor: pointer;
        white-space: nowrap;
      }

      mwc-list-item.delete-item {
        color: var(--error-color);
      }

      .drag-handle {
        cursor: move;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hui-grid-card-options': HuiGridCardOptions;
  }
}
