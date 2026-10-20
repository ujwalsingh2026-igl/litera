import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Trash2 } from 'lucide-react';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';

export const HorizontalRuleView: React.FC<NodeViewProps> = ({
  selected,
  deleteNode,
  editor,
  getPos,
}) => {
  return (
    <NodeViewWrapper
      className={`literia-hr-component my-2.5 py-1.5 cursor-pointer select-none group relative transition-all ${
        selected ? 'ProseMirror-selectednode' : ''
      }`}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (typeof pos === 'number') {
            editor.commands.setNodeSelection(pos);
            editor.commands.focus();
          }
        }
      }}
    >
      <div className="relative flex items-center justify-center py-1">
        <hr
          className={`w-full border-t transition-all ${
            selected
              ? 'border-amber-500 dark:border-amber-400 ring-2 ring-amber-500/40 rounded-full'
              : 'border-stone-300 dark:border-stone-700 group-hover:border-amber-400 dark:group-hover:border-amber-500'
          }`}
        />

        {/* Quick action remove pill on hover or selection */}
        <div
          className={`absolute flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-sans font-medium shadow-md transition-all z-10 ${
            selected
              ? 'opacity-100 scale-100 bg-amber-600 text-white shadow-amber-500/20'
              : 'opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900'
          }`}
        >
          <span className="text-[10px] uppercase tracking-wider font-semibold opacity-90">Divider</span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              deleteNode();
              editor.commands.focus();
            }}
            className="flex items-center gap-1 hover:text-red-300 dark:hover:text-red-600 transition pl-1.5 border-l border-white/25 dark:border-black/25 text-red-200 dark:text-red-700 font-semibold cursor-pointer"
            title="Remove divider line"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const CustomHorizontalRule = Node.create({
  name: 'horizontalRule',

  group: 'block',

  selectable: true,

  draggable: true,

  parseHTML() {
    return [{ tag: 'hr' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HorizontalRuleView);
  },

  addCommands() {
    return {
      setHorizontalRule:
        () =>
        ({ chain, state }) => {
          const { selection } = state;
          const { $to: $originTo } = selection;
          const currentChain = chain().focus();

          if (selection instanceof NodeSelection) {
            currentChain.insertContentAt($originTo.pos, { type: this.name });
          } else {
            currentChain.insertContent({ type: this.name });
          }

          return currentChain
            .command(({ state: chainState, tr, dispatch }) => {
              if (dispatch) {
                const { $to } = tr.selection;
                const posAfter = $to.end();
                if ($to.nodeAfter) {
                  if ($to.nodeAfter.isTextblock) {
                    tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1));
                  } else {
                    tr.setSelection(NodeSelection.create(tr.doc, $to.pos));
                  }
                } else {
                  const nodeType = chainState.schema.nodes.paragraph;
                  const node = nodeType?.create();
                  if (node) {
                    tr.insert(posAfter, node);
                    tr.setSelection(TextSelection.create(tr.doc, posAfter + 1));
                  }
                }
                tr.scrollIntoView();
              }
              return true;
            })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state, dispatch } = this.editor.view;
        const { selection } = state;

        // If the node itself is selected via NodeSelection, delete it
        if (selection instanceof NodeSelection && selection.node.type.name === this.name) {
          const tr = state.tr.deleteSelection();
          dispatch(tr);
          return true;
        }

        // If cursor is at the very start of a block immediately following a horizontal rule
        if (selection.empty && selection.$from.parentOffset === 0) {
          const { $from } = selection;
          const nodeBefore = $from.nodeBefore;
          if (nodeBefore && nodeBefore.type.name === this.name) {
            const tr = state.tr.delete($from.pos - nodeBefore.nodeSize, $from.pos);
            dispatch(tr);
            return true;
          }
        }
        return false;
      },
      Delete: () => {
        const { state, dispatch } = this.editor.view;
        const { selection } = state;

        // If node itself is selected, delete it
        if (selection instanceof NodeSelection && selection.node.type.name === this.name) {
          const tr = state.tr.deleteSelection();
          dispatch(tr);
          return true;
        }

        // If cursor is at the very end of a block immediately preceding a horizontal rule
        if (selection.empty && selection.$from.parentOffset === selection.$from.parent.content.size) {
          const { $from } = selection;
          const nodeAfter = $from.nodeAfter;
          if (nodeAfter && nodeAfter.type.name === this.name) {
            const tr = state.tr.delete($from.pos, $from.pos + nodeAfter.nodeSize);
            dispatch(tr);
            return true;
          }
        }
        return false;
      },
    };
  },
});
