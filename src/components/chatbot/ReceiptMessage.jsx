import React from 'react';

const ReceiptMessage = ({ content }) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
        <div className="text-4xl mb-2">🎉</div>
        <h3 className="font-bold text-xl text-gray-800 mb-1">
          Order Placed Successfully!
        </h3>
        <p className="text-sm text-gray-600">
          Thank you for your order! Here's your receipt:
        </p>
      </div>
      
      {/* Receipt Details */}
      <div className="bg-white rounded-lg p-4 border-2 border-dashed border-gray-300 shadow-sm">
        {/* Order Header */}
        <div className="text-center mb-4 pb-3 border-b border-gray-200">
          <h4 className="font-bold text-lg text-gray-800">Restaurant Receipt</h4>
          <p className="text-sm text-gray-600">Order #{content.orderId}</p>
          <p className="text-xs text-gray-500">{content.orderTime}</p>
        </div>
        
        {/* Order Items */}
        <div className="space-y-2 mb-4">
          <h5 className="font-semibold text-gray-700 mb-2">Order Items:</h5>
          {content.items.map((item, index) => (
            <div key={index} className="flex justify-between items-center py-1">
              <div className="flex-1">
                <span className="text-sm text-gray-800">{item.name}</span>
                <span className="text-xs text-gray-500 ml-2">x{item.quantity}</span>
              </div>
              <span className="text-sm font-medium text-gray-800">${item.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
        
        {/* Order Summary */}
        <div className="border-t border-gray-200 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal:</span>
            <span className="text-gray-800">${content.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tax (8%):</span>
            <span className="text-gray-800">${content.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2 mt-2">
            <span className="text-gray-800">Total:</span>
            <span className="text-green-600">${content.total.toFixed(2)}</span>
          </div>
        </div>
        
        {/* Order Info */}
        <div className="mt-4 pt-3 border-t border-gray-200 text-center">
          <div className="bg-blue-50 rounded-lg p-3 mb-2">
            <p className="text-sm font-semibold text-blue-800 mb-1">
              📋 Estimated Preparation Time
            </p>
            <p className="text-lg font-bold text-blue-600">
              {content.estimatedTime}
            </p>
          </div>
          
          <div className="text-xs text-gray-500 space-y-1">
            <p>Your order is being prepared with care</p>
            <p>You'll receive a notification when it's ready</p>
            <p className="font-medium text-green-600">Thank you for choosing us! 🍽️</p>
          </div>
        </div>
      </div>
      
      <div className="text-center mt-4 pt-3 border-t">
        <p className="text-sm text-gray-600 mb-2">
          Your cart has been cleared. Ready for your next order!
        </p>
        <p className="text-xs text-gray-500">
          💬 Say "What's on the menu?" to start a new order
        </p>
      </div>
    </div>
  );
};

export default ReceiptMessage;