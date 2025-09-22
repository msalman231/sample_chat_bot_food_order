import React from 'react';

const CartMessage = ({ content }) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="font-bold text-lg text-gray-800 mb-1">
          🛒 {content.isRemovalHelp ? 'Items in Your Cart' : 'Your Cart'}
        </h3>
        <p className="text-sm text-gray-600">
          {content.isRemovalHelp 
            ? 'Which item would you like to remove?'
            : content.summary || `${content.items.length} item${content.items.length !== 1 ? 's' : ''} in your order`
          }
        </p>
      </div>
      
      <div className="space-y-3">
        {content.items.map((item, index) => (
          <div 
            key={index} 
            className={`bg-white rounded-lg p-3 border shadow-sm ${content.isRemovalHelp ? 'hover:bg-red-50 hover:border-red-200 cursor-pointer' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-800">{item.name}</p>
                <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
              </div>
              <div className="text-right">
                {content.isRemovalHelp ? (
                  <p className="text-sm text-red-600 font-medium">🗑️ Remove</p>
                ) : (
                  <>
                    <p className="font-bold text-primary-600">${item.total.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">${item.price} each</p>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {!content.isRemovalHelp && (
        <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-lg text-gray-800">Total:</span>
            <span className="font-bold text-xl text-primary-600">${content.total.toFixed(2)}</span>
          </div>
          <div className="text-center mt-3">
            <p className="text-xs text-gray-600">
              💬 Say "remove [item name]" to remove items, or "checkout" when ready!
            </p>
          </div>
        </div>
      )}
      
      {content.isRemovalHelp && (
        <div className="text-center mt-4 pt-3 border-t">
          <p className="text-xs text-gray-500">
            💬 Say "remove [item name]" to remove that item from your cart
          </p>
        </div>
      )}
    </div>
  );
};

export default CartMessage;