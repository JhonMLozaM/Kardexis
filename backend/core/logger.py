import logging
import sys

import structlog


def setup_logging():
    """Configurar structlog para la aplicacion"""

    # Configurar procesadores de structlog
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Configurar logging stdlib para que structlog lo maneje
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )

# Crear logger global
logger = structlog.get_logger()


def log_login_success(username: str, user_id: str):
    logger.info("login_success", username=username, user_id=user_id)

def log_login_failed(username: str, reason: str):
    logger.warning("login_failed", username=username, reason=reason)

def log_sale_created(sale_id: str, user_id: str, total: float, client_name: str):
    logger.info("sale_created", sale_id=sale_id, user_id=user_id, total=total, client_name=client_name)

def log_kardex_transaction(tx_id: str, product_id: str, tx_type: str, quantity: float, user_id: str):
    logger.info("kardex_transaction", tx_id=tx_id, product_id=product_id, type=tx_type, quantity=quantity, user_id=user_id)

def log_attendance_checkin(user_id: str, time: str):
    logger.info("attendance_checkin", user_id=user_id, time=time)

def log_attendance_checkout(user_id: str, time: str):
    logger.info("attendance_checkout", user_id=user_id, time=time)

def log_product_created(product_id: str, name: str, user_id: str):
    logger.info("product_created", product_id=product_id, name=name, user_id=user_id)

def log_product_deleted(product_id: str, user_id: str):
    logger.info("product_deleted", product_id=product_id, user_id=user_id)

def log_customer_created(customer_id: str, dni_ruc: str, name: str):
    logger.info("customer_created", customer_id=customer_id, dni_ruc=dni_ruc, name=name)

def log_error(context: str, error: str, details: dict = None):
    logger.error("application_error", context=context, error=error, details=details)
