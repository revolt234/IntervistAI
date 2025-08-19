// file: hooks/useUIManager.ts
import { useState } from 'react';

export const useUIManager = () => {
  const [isToolsMenuVisible, setToolsMenuVisible] = useState(false);
  const [showChartsModal, setShowChartsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Esponiamo azioni con nomi chiari invece dei semplici setter
  const uiActions = {
    openToolsMenu: () => setToolsMenuVisible(true),
    closeToolsMenu: () => setToolsMenuVisible(false),
    openChartsModal: () => setShowChartsModal(true),
    closeChartsModal: () => setShowChartsModal(false),
    openHistoryModal: () => setShowHistoryModal(true),
    closeHistoryModal: () => setShowHistoryModal(false),
    openExportModal: () => setShowExportModal(true),
    closeExportModal: () => setShowExportModal(false),
    setFirstLoad: setIsFirstLoad,
  };

  const uiState = {
    isToolsMenuVisible,
    showChartsModal,
    showHistoryModal,
    showExportModal,
    isFirstLoad,
  };

  return { uiState, uiActions };
};