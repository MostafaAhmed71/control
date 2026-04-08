# Shared OMR Constants
WIDTH, HEIGHT = 2481, 3507
MARGIN = 150
CORNER_MARKER_SIZE = 80 
MARKER_CENTER_OFFSET = MARGIN + CORNER_MARKER_SIZE // 2

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)

# Professional Header Grid
HEADER_START_Y = MARGIN + 400
HEADER_WIDTH = WIDTH - 2 * MARGIN - 380 # Save space for QR on right
HEADER_ROW_H = 120
HEADER_END_Y = HEADER_START_Y + (HEADER_ROW_H * 4) + 50

# QR Identification (Top Right)
QR_SIZE = 350 
QR_X = WIDTH - MARGIN - QR_SIZE
QR_Y = HEADER_START_Y + 65

# Question Section
QS_START_Y = HEADER_END_Y + 200
QS_ROW_SPACING = 115
QS_OPT_SPACING = 140
QS_ROW0_CENTER_Y = QS_START_Y + 150

# Question layout helpers
QS_COL_GAP   = 200   # gap between right and left columns
QS_OPT_START = 80    # x offset from col_x to first bubble center
QS_BUBBLE_R  = 50    # bubble radius in pixels
