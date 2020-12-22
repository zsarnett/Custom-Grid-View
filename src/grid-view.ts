/* eslint-disable @typescript-eslint/ban-ts-ignore */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mdiPlus, mdiResizeBottomRight } from '@mdi/js';
import {
  computeCardSize,
  computeRTL,
  fireEvent,
  HomeAssistant,
  LovelaceCard,
  LovelaceViewConfig,
} from 'custom-card-helpers';
import {
  css,
  CSSResult,
  customElement,
  html,
  internalProperty,
  LitElement,
  property,
  PropertyValues,
  TemplateResult,
} from 'lit-element';
import 'lit-grid-layout';
import { classMap } from 'lit-html/directives/class-map';
import { v4 as uuidv4 } from 'uuid';
import { nextRender, replaceView } from './functions';
import './hui-grid-card-options';
import { HuiGridCardOptions } from './hui-grid-card-options';

const mediaQueryColumns = [2, 6, 9, 12];

interface LovelaceGridCard extends LovelaceCard, HuiGridCardOptions {
  key: string;
  grid?: {
    key: string;
    width: number;
    height: number;
    posX: number;
    posY: number;
  };
}

const RESIZE_HANDLE = document.createElement('div') as HTMLElement;
RESIZE_HANDLE.style.cssText = 'width: 100%; height: 100%; cursor: se-resize; fill: var(--primary-text-color)';
RESIZE_HANDLE.innerHTML = `
  <svg
    viewBox="0 0 24 24"
    preserveAspectRatio="xMidYMid meet"
    focusable="false"
  >
    <g><path d=${mdiResizeBottomRight}></path></g>
  </svg>
`;

@customElement('grid-dnd')
export class GridView extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public lovelace?: any;

  @property({ type: Number }) public index?: number;

  @property({ attribute: false }) public cards: Array<LovelaceGridCard> = [];

  @property({ attribute: false }) public badges: any[] = [];

  @internalProperty() private _columns?: number;

  @internalProperty() private _layout?: Array<{
    width: number;
    height: number;
    posX: number;
    posY: number;
    key: string;
  }>;

  @internalProperty() public _cards: {
    [key: string]: LovelaceCard | any;
  } = {};

  private _config?: LovelaceViewConfig;

  private _layoutEdit?: Array<{
    width: number;
    height: number;
    posX: number;
    posY: number;
    key: string;
  }>;

  private _createColumnsIteration = 0;

  private _mqls?: MediaQueryList[];

  public constructor() {
    super();
    this.addEventListener('iron-resize', (ev: Event) => ev.stopPropagation());
  }

  public setConfig(config: LovelaceViewConfig): void {
    this._config = config;
  }

  protected render(): TemplateResult {
    return html`
      ${this.lovelace.editMode
        ? html`
            <div class="toolbar">
              <mwc-button @click=${this._saveView} raised>Save Layout</mwc-button>
            </div>
          `
        : ''}
      <div id="badges" style=${this.badges.length > 0 ? 'display: block' : 'display: none'}>
        ${this.badges.map(
          badge =>
            html`
              ${badge}
            `,
        )}
      </div>
      <lit-grid-layout
        rowHeight="40"
        .containerPadding=${[8, 8]}
        .margin=${[8, 8]}
        .resizeHandle=${RESIZE_HANDLE}
        .itemRenderer=${this._itemRenderer}
        .layout=${this._layout}
        .columns=${this._columns}
        .dragHandle=${'.overlay'}
        .dragDisabled=${!this.lovelace?.editMode}
        .resizeDisabled=${!this.lovelace?.editMode}
        @item-changed=${this._saveLayout}
      ></lit-grid-layout>
      ${this.lovelace?.editMode
        ? html`
            <mwc-fab
              class=${classMap({
                rtl: computeRTL(this.hass!),
              })}
              .title=${this.hass!.localize('ui.panel.lovelace.editor.edit_card.add')}
              @click=${this._addCard}
            >
              <ha-svg-icon slot="icon" .path=${mdiPlus}></ha-svg-icon>
            </mwc-fab>
          `
        : ''}
    `;
  }

  protected firstUpdated(): void {
    this._updateColumns = this._updateColumns.bind(this);
    this._mqls = [300, 600, 900, 1200].map(width => {
      const mql = matchMedia(`(min-width: ${width}px)`);
      mql.addEventListener('change', this._updateColumns);
      return mql;
    });
    this._updateCardsWithID();
    this._updateColumns();
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (changedProperties.has('hass')) {
      const oldHass = changedProperties.get('hass') as HomeAssistant;

      if ((oldHass && this.hass!.dockedSidebar !== oldHass.dockedSidebar) || (!oldHass && this.hass)) {
        this._updateColumns();
      }

      if (changedProperties.size === 1) {
        return;
      }
    }

    const oldLovelace = changedProperties.get('lovelace') as any | undefined;

    if (
      (changedProperties.has('lovelace') &&
        (oldLovelace?.config !== this.lovelace?.config || oldLovelace?.editMode !== this.lovelace?.editMode)) ||
      changedProperties.has('_columns')
    ) {
      if (!this._layout?.length) {
        this._createLayout();
        return;
      }

      this._createCards();
    }

    if (changedProperties.has('lovelace') && this.lovelace.editMode && !oldLovelace.editMode) {
      this._layoutEdit = this._layout;
    }

    if (changedProperties.has('lovelace') && !this.lovelace.editMode && oldLovelace.editMode) {
      this._layout = (this._config as any).layout;
    }
  }

  private _updateCardsWithID(): void {
    if (!this._config) {
      return;
    }

    if (this._config.cards!.filter(card => !card.layout?.key).length === 0) {
      return;
    }

    const cards = this._config.cards!.map(card => {
      if (card.layout?.key) {
        return card;
      }
      card = { ...card, layout: { key: card.layout?.key || uuidv4() } };
      return card;
    });

    const newConfig = { ...this._config, cards };

    this.lovelace.saveConfig(replaceView(this.lovelace!.config, this.index!, newConfig));
  }

  private async _createLayout(): Promise<void> {
    this._createColumnsIteration++;
    const iteration = this._createColumnsIteration;

    if (this._layout?.length) {
      return;
    }

    const newLayout: Array<{
      width: number;
      height: number;
      posX: number;
      posY: number;
      key: string;
      minHeight: number;
    }> = [];

    let tillNextRender: Promise<unknown> | undefined;
    let start: Date | undefined;

    // Calculate the size of every card and determine in what column it should go
    for (const [index, card] of this.cards.entries()) {
      const cardConfig = this._config!.cards![index];

      const currentLayout = (this._config as any).layout?.find(item => item.key === cardConfig.layout?.key);

      if (currentLayout) {
        newLayout.push(currentLayout);
        continue;
      }

      console.log('not in current layout: ', cardConfig);

      if (tillNextRender === undefined) {
        // eslint-disable-next-line no-loop-func
        tillNextRender = nextRender().then(() => {
          tillNextRender = undefined;
          start = undefined;
        });
      }

      let waitProm: Promise<unknown> | undefined;

      // We should work for max 16ms (60fps) before allowing a frame to render
      if (start === undefined) {
        // Save the time we start for this frame, no need to wait yet
        start = new Date();
      } else if (new Date().getTime() - start.getTime() > 16) {
        // We are working too long, we will prevent a render, wait to allow for a render
        waitProm = tillNextRender;
      }

      const cardSizeProm = computeCardSize(card);
      // @ts-ignore
      // eslint-disable-next-line no-await-in-loop
      const [cardSize] = await Promise.all([cardSizeProm, waitProm]);

      if (iteration !== this._createColumnsIteration) {
        // An other create columns is started, abort this one
        return;
      }

      const computedLayout = {
        width: 3,
        height: cardSize,
        key: cardConfig.layout?.key,
      };

      newLayout.push({
        ...computedLayout,
        ...currentLayout,
      });
    }

    this._layout = newLayout;
    this._createCards();
  }

  private _createCards(): void {
    const elements = {};

    this.cards.forEach((card: LovelaceGridCard, index) => {
      const cardLayout = this._layout![index];

      if (!cardLayout) {
        return;
      }

      card.editMode = this.lovelace?.editMode;
      let element = card;

      if (this.lovelace?.editMode) {
        const wrapper = document.createElement('hui-grid-card-options') as LovelaceGridCard;
        wrapper.hass = this.hass;
        wrapper.lovelace = this.lovelace;
        wrapper.path = [this.index!, index];
        wrapper.appendChild(card);
        element = wrapper;
      }

      elements[cardLayout.key] = element;
    });

    this._cards = elements;
  }

  private _saveLayout(ev: CustomEvent): void {
    this._layoutEdit = ev.detail.layout;
  }

  private async _saveView(): Promise<void> {
    const viewConf: any = {
      ...this._config,
      layout: this._layoutEdit,
    };

    await this.lovelace?.saveConfig(replaceView(this.lovelace!.config, this.index!, viewConf));
  }

  private _itemRenderer = (key: string): TemplateResult => {
    if (!this._cards) {
      return html``;
    }

    return html`
      ${this._cards[key]}
    `;
  };

  private _addCard(): void {
    fireEvent(this, 'll-create-card' as any);
  }

  private _updateColumns(): void {
    if (!this._mqls) {
      return;
    }
    const matchColumns = this._mqls!.reduce((cols, mql) => cols + Number(mql.matches), 0);
    // Do -1 column if the menu is docked and open
    this._columns = Math.max(1, mediaQueryColumns[matchColumns - 1]);
  }

  static get styles(): CSSResult {
    return css`
      :host {
        display: block;
        box-sizing: border-box;
        padding: 4px 4px env(safe-area-inset-bottom);
        transform: translateZ(0);
        position: relative;
        color: var(--primary-text-color);
        background: var(--lovelace-background, var(--primary-background-color));
      }

      lit-grid-layout {
        --placeholder-background-color: var(--accent-color);
        --resize-handle-size: 32px;
      }

      #badges {
        margin: 8px 16px;
        font-size: 85%;
        text-align: center;
      }

      mwc-fab {
        position: sticky;
        float: right;
        right: calc(16px + env(safe-area-inset-right));
        bottom: calc(16px + env(safe-area-inset-bottom));
        z-index: 5;
      }

      mwc-fab.rtl {
        float: left;
        right: auto;
        left: calc(16px + env(safe-area-inset-left));
      }

      .toolbar {
        background-color: var(--divider-color);
        border-bottom-left-radius: var(--ha-card-border-radius, 4px);
        border-bottom-right-radius: var(--ha-card-border-radius, 4px);
        padding: 8px;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'grid-dnd': GridView;
  }
}
